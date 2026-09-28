import argparse
import yaml
import json
import torch
from pathlib import Path
from datetime import datetime
from datasets import load_dataset
from tqdm import tqdm
from transformers import AutoProcessor, AutoModelForCausalLM
from peft import PeftModel
import sys

# Ensure src is importable
sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.dataset import QwenVLDataset

def main():
    parser = argparse.ArgumentParser(description="Evaluate Fine-tuned VLM")
    parser.add_argument("--base_model", type=str, required=True, help="Base model name or path")
    parser.add_argument("--adapter_path", type=str, help="Path to LoRA adapter (optional for baseline)")
    parser.add_argument("--dataset", type=str, required=True, help="Path to evaluation JSONL")
    parser.add_argument("--image_root", type=str, default="data/images/", help="Root directory for image paths")
    parser.add_argument("--output_dir", type=str, default="evaluation_results")
    parser.add_argument("--dry_run", action="store_true", help="Run without actually evaluating")
    args = parser.parse_args()

    out_dir = Path(args.output_dir)
    out_dir.mkdir(exist_ok=True, parents=True)
    
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    mode_prefix = "finetuned" if args.adapter_path else "baseline"
    result_file = out_dir / f"{mode_prefix}_eval_results_{run_id}.json"
    predictions_file = out_dir / f"{mode_prefix}_predictions_{run_id}.jsonl"

    print(f"Starting Evaluation")
    print(f"Base Model: {args.base_model}")
    print(f"Adapter: {args.adapter_path if args.adapter_path else 'None (Baseline)'}")
    print(f"Dataset: {args.dataset}")

    if args.dry_run:
        print("\n[DRY RUN] Simulating evaluation...")
        results = {
            "model": args.base_model,
            "adapter": args.adapter_path,
            "dataset": args.dataset,
            "metrics": {
                "binary_vqa_accuracy": 0.85,
                "multiple_choice_accuracy": 0.78
            }
        }
        with open(result_file, "w") as f:
            json.dump(results, f, indent=4)
        print(f"[DRY RUN] Results saved to {result_file}")
        return

    # 1. Load model and processor
    print("Loading processor and model (this may take a while)...")
    processor = AutoProcessor.from_pretrained(args.base_model, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        args.base_model, 
        device_map="auto" if torch.cuda.is_available() else "cpu", 
        torch_dtype=torch.float16,
        trust_remote_code=True
    )

    if args.adapter_path:
        print(f"Loading adapter from {args.adapter_path}...")
        model = PeftModel.from_pretrained(model, args.adapter_path)
    
    model.eval()

    # 2. Load Real Dataset
    print(f"Loading dataset from {args.dataset}...")
    try:
        eval_dataset = QwenVLDataset(args.dataset, image_root=args.image_root)
    except Exception as e:
        print(f"CRITICAL ERROR loading dataset: {e}")
        exit(1)
        
    correct_binary = 0
    total_binary = 0
    correct_mc = 0
    total_mc = 0
    total = len(eval_dataset)
    
    print("Running inference...")
    
    with open(predictions_file, "w") as f_out:
        with torch.no_grad():
            for i in tqdm(range(len(eval_dataset))):
                item = eval_dataset[i]
                record = eval_dataset.records[i]
                messages = item["messages"]
                
                # Exclude the assistant answer from the prompt since we are generating it
                prompt_messages = [m for m in messages if m["role"] != "assistant"]
                
                # Format using processor
                text = processor.apply_chat_template(prompt_messages, tokenize=False, add_generation_prompt=True)
                
                # Extract images
                image_inputs = [msg_dict["content"][img_idx]["image"] 
                                for msg_dict in prompt_messages 
                                for img_idx in range(len(msg_dict.get("content", []))) 
                                if isinstance(msg_dict.get("content", [])[img_idx], dict) and msg_dict["content"][img_idx].get("type") == "image"]
                
                # Forward to device
                inputs = processor(text=text, images=image_inputs, padding=True, return_tensors="pt")
                inputs = {k: v.to(model.device) for k, v in inputs.items()}
                
                # Generate
                generated_ids = model.generate(**inputs, max_new_tokens=128)
                
                # Strip prompt from generated tokens
                generated_ids_trimmed = [
                    out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
                ]
                output_text = processor.batch_decode(generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False)[0]
                
                pred = output_text.strip().lower()
                truth = record.answer.strip().lower()
                
                is_correct = (pred == truth) or (truth in pred)
                
                if record.task_type == "binary_vqa":
                    total_binary += 1
                    if is_correct:
                        correct_binary += 1
                elif record.task_type == "multiple_choice_vqa":
                    total_mc += 1
                    if is_correct:
                        correct_mc += 1
                        
                prediction_record = {
                    "id": record.id,
                    "task_type": record.task_type,
                    "question": record.question,
                    "ground_truth": record.answer,
                    "prediction": output_text.strip(),
                    "correct": is_correct
                }
                
                f_out.write(json.dumps(prediction_record) + "\n")
                f_out.flush()
            
    # Calculate Metrics
    accuracy_binary = (correct_binary / total_binary) if total_binary > 0 else 0.0
    accuracy_mc = (correct_mc / total_mc) if total_mc > 0 else 0.0
    accuracy_overall = ((correct_binary + correct_mc) / (total_binary + total_mc)) if (total_binary + total_mc) > 0 else 0.0
    
    results = {
        "model": args.base_model,
        "adapter": args.adapter_path,
        "dataset": args.dataset,
        "total_samples": total,
        "metrics": {
            "overall_accuracy": accuracy_overall,
            "binary_vqa_accuracy": accuracy_binary,
            "multiple_choice_accuracy": accuracy_mc,
            "binary_samples": total_binary,
            "mc_samples": total_mc
        }
    }
    
    with open(result_file, "w") as f:
        json.dump(results, f, indent=4)
        
    print(f"Evaluation complete.")
    print(f"Metrics saved to {result_file}")
    print(f"Detailed predictions saved to {predictions_file}")
    print(f"Overall Accuracy: {accuracy_overall:.2f}")

if __name__ == "__main__":
    main()
