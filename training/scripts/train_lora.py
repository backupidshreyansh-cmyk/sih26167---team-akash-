import argparse
import yaml
import os
import json
import torch
import time
from pathlib import Path
from datetime import datetime
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM, 
    AutoProcessor, 
    TrainingArguments,
    Trainer,
    TrainerCallback,
    BitsAndBytesConfig
)
import sys

# Ensure src is importable
sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.dataset import QwenVLDataset
from src.collator import QwenVLDataCollator

class SafeLocalPilotCallback(TrainerCallback):
    """
    Logs memory, step time, and acts as a safety valve.
    """
    def __init__(self):
        self.step_start_time = None

    def on_step_begin(self, args, state, control, **kwargs):
        self.step_start_time = time.time()

    def on_step_end(self, args, state, control, **kwargs):
        if self.step_start_time:
            step_time = time.time() - self.step_start_time
        else:
            step_time = 0

        vram_allocated = torch.cuda.memory_allocated() / (1024**3)
        vram_reserved = torch.cuda.memory_reserved() / (1024**3)
        
        try:
            peak_vram = torch.cuda.max_memory_allocated() / (1024**3)
        except:
            peak_vram = 0

        print(f"\n[Step {state.global_step}] Loss: {state.log_history[-1].get('loss', 'N/A') if state.log_history else 'N/A'} | Time: {step_time:.2f}s")
        print(f"VRAM -> Allocated: {vram_allocated:.2f} GB | Reserved: {vram_reserved:.2f} GB | Peak: {peak_vram:.2f} GB")

        # Emergency Stop if memory allocation balloons out of control (Optional)
        # However, OOM will crash naturally.

def enforce_hardware_safety(config, args):
    if not torch.cuda.is_available():
        print("CRITICAL ERROR: CUDA GPU unavailable.")
        print("Training has been stopped to prevent an unintended CPU training run.")
        exit(1)
        
    vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
    print(f"[Hardware Guard] Detected VRAM: {vram_gb:.2f} GB")
    
    # RTX 4050 6GB constraint logic
    if vram_gb < 7.0 and not args.allow_risky_config:
        print("[Hardware Guard] Engaging constraints for 6GB-class VRAM.")
        
        if config.get("per_device_train_batch_size", 1) > 1:
            print("CRITICAL ERROR: batch_size > 1 is refused for < 7GB VRAM.")
            exit(1)
            
        if not config.get("load_in_4bit", False):
            print("CRITICAL ERROR: 4-bit quantization (load_in_4bit) is mandatory for < 7GB VRAM to avoid OOM.")
            exit(1)
            
        if config.get("dataloader_num_workers", 0) > 0:
            print("CRITICAL ERROR: Concurrent workers > 0 refused to preserve memory.")
            exit(1)

def main():
    parser = argparse.ArgumentParser(description="LoRA Fine-tuning for Remote Sensing VLM")
    parser.add_argument("--config", type=str, required=True, help="Path to YAML config")
    parser.add_argument("--dry_run", action="store_true", help="Run without actually starting training")
    parser.add_argument("--smoke_test", action="store_true", help="Run a real forward/backward pass on a tiny subset")
    parser.add_argument("--pilot", action="store_true", help="Strict pilot mode (10 steps max) to safely test memory")
    parser.add_argument("--allow_risky_config", action="store_true", help="Override VRAM safety guards (DANGEROUS)")
    parser.add_argument("--image_root", type=str, default="data/images/", help="Root directory for image paths")
    args = parser.parse_args()

    with open(args.config, 'r') as f:
        config = yaml.safe_load(f)

    # 1. Hardware Guard Before Anything Else
    if not args.dry_run:
        enforce_hardware_safety(config, args)

    # 2. Setup Tracking and Run Directory
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = Path(config['output_dir']) / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    
    # Save config
    with open(run_dir / "config.yaml", "w") as f:
        yaml.dump(config, f)

    print(f"\nStarting Training Run: {run_id}")
    print(f"Target Model: {config['model_name_or_path']}")

    if args.dry_run:
        print("\n[DRY RUN] Simulating pipeline initialization...")
        adapter_dir = run_dir / "adapter"
        adapter_dir.mkdir(exist_ok=True)
        with open(adapter_dir / "adapter_config.json", "w") as f:
            json.dump({"peft_type": "LORA", "r": config['lora_r']}, f)
        print(f"\n[DRY RUN] Adapter artifacts simulated at {adapter_dir}")
        return

    # 3. Load Model & Processor
    print("Loading processor and Qwen3-VL model (this may take a while)...")
    processor = AutoProcessor.from_pretrained(config['model_name_or_path'], trust_remote_code=True)
    
    # 4-Bit Config for 6GB RTX 4050 limits
    quantization_config = None
    if config.get("load_in_4bit", False):
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.bfloat16 if config.get('mixed_precision') == 'bf16' else torch.float16,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4"
        )
    
    model = AutoModelForCausalLM.from_pretrained(
        config['model_name_or_path'],
        device_map="auto" if torch.cuda.is_available() else "cpu",
        torch_dtype=torch.bfloat16 if config.get('mixed_precision') == 'bf16' else torch.float16,
        quantization_config=quantization_config,
        trust_remote_code=True
    )
    
    if config.get('gradient_checkpointing'):
        model.gradient_checkpointing_enable()

    if config.get("load_in_4bit", False):
        model = prepare_model_for_kbit_training(model)

    # Model Module Inspection
    print("\n--- Model Module Inspection ---")
    module_names = [name for name, _ in model.named_modules()]
    for target in config['target_modules']:
        if not any(target in name for name in module_names):
            print(f"CRITICAL ERROR: Configured LoRA target module '{target}' NOT found in the model!")
            exit(1)
    print("All configured LoRA target modules verified.")

    # 4. PEFT LoRA Setup
    print("Applying LoRA...")
    lora_config = LoraConfig(
        r=config['lora_r'],
        lora_alpha=config['lora_alpha'],
        target_modules=config['target_modules'],
        lora_dropout=config['lora_dropout'],
        bias="none",
        task_type="CAUSAL_LM"
    )
    
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # 5. Load Dataset
    print(f"Loading real multimodal dataset from {config['dataset_path']}...")
    try:
        train_dataset = QwenVLDataset(config['dataset_path'], image_root=args.image_root)
    except Exception as e:
        print(f"CRITICAL ERROR loading dataset: {e}")
        exit(1)

    max_steps = config.get("max_steps", -1)
    
    if args.pilot:
        print("\n[PILOT MODE ACTIVE]")
        print("Limiting dataset and steps severely for safe hardware testing.")
        limit = config.get("max_samples", 10)
        train_dataset.records = train_dataset.records[:limit]
        config['num_train_epochs'] = 1
        max_steps = config.get("max_steps", 10)
        
    elif args.smoke_test:
        print("\n[SMOKE TEST MODE ACTIVE]")
        train_dataset.records = train_dataset.records[:2]
        config['num_train_epochs'] = 1
        max_steps = 2
        
    print(f"Active training records: {len(train_dataset)}")

    collator = QwenVLDataCollator(processor=processor)

    # 6. Training Arguments
    training_args = TrainingArguments(
        output_dir=str(run_dir),
        per_device_train_batch_size=config['per_device_train_batch_size'],
        gradient_accumulation_steps=config['gradient_accumulation_steps'],
        learning_rate=float(config['learning_rate']),
        num_train_epochs=config['num_train_epochs'],
        max_steps=max_steps,
        logging_steps=1 if (args.smoke_test or args.pilot) else 10,
        save_strategy=config.get('save_strategy', 'no') if not args.smoke_test else "no",
        save_steps=config.get('save_steps', 500),
        fp16=(config.get('mixed_precision') == 'fp16'),
        bf16=(config.get('mixed_precision') == 'bf16'),
        remove_unused_columns=False,
        report_to="none" 
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        data_collator=collator,
        callbacks=[SafeLocalPilotCallback()]
    )

    # 7. Train
    print("Starting real multimodal training...")
    try:
        trainer.train()
    except torch.cuda.OutOfMemoryError:
        print("\nCRITICAL: CUDA Out of Memory!")
        print("Your GPU could not handle this configuration. Try increasing gradient accumulation or reducing sequence length.")
        exit(1)

    # 8. Save Adapter
    adapter_dir = run_dir / "adapter"
    print(f"\nSaving LoRA adapter to {adapter_dir}...")
    trainer.model.save_pretrained(str(adapter_dir))
    processor.save_pretrained(str(adapter_dir))
    
    print("Training complete! Adapter generated successfully.")

if __name__ == "__main__":
    main()
