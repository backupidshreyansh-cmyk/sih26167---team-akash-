# ORBITAL EYE: Remote Sensing Adaptation Pipeline

This subsystem implements the actual PEFT/LoRA fine-tuning pipeline required for the SIH 26167 "Remote Sensing Adaptation" criteria.

It uses a structured JSONL schema supporting multiple modalities (Optical, SAR, Bi-Temporal) and trains standard Hugging Face Vision-Language Models (defaulting to `Qwen/Qwen3-VL-4B-Instruct`) using parameter-efficient fine-tuning (LoRA).

**IMPORTANT:** This pipeline operates independently from the Node.js production server. 

## 1. Environment Setup

It is highly recommended to run this on a machine with a dedicated NVIDIA GPU (minimum 12GB VRAM, 24GB recommended for 4B models).

```bash
# 1. Create a Python virtual environment (or conda)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 2. Install PyTorch with CUDA support (adjust for your CUDA version)
# Example for CUDA 12.1:
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# 3. Install remaining dependencies
pip install -r requirements.txt
```

## 2. Hardware Inspection

Before starting, verify your hardware meets the requirements:

```bash
python scripts/hardware_inspect.py
```
This will report your CPU, RAM, CUDA availability, VRAM, and recommend a training configuration mode.

## 3. Dataset Preparation

BigEarthNet v2 contains 12-band Sentinel-2 data and 2-band Sentinel-1 data. Standard Visual Language Models (like Qwen3-VL-4B) natively accept 3-channel RGB image inputs, not raw 14-channel tensors. 

**Spectral Preservation Strategy:**
To bridge this gap while preserving analytical integrity:
1. The script extracts the raw tensors (S1 and S2) and saves them natively as `.npy` arrays in `data/tensors/`.
2. The script converts the data into standard `optical_rgb` (True Color) and `sar_rgb` (False Color) 3-channel representations using robust percentile normalization. These are saved to `data/images/`.
3. The resulting `pilot_training.jsonl` schema explicitly links both the VLM-compatible `path` and the raw `tensor_path`, ensuring the dataset can be used seamlessly for QLoRA adaptation while keeping the door open for future custom multi-channel patch encoders.

### Prepare the Pilot Dataset
To execute the data preparation pipeline on the 20 verified pilot patches:
```bash
python scripts/prepare_pilot_dataset.py
```
This will:
- Load the BigEarthNet annotations from `BigEarthNet.txt.parquet`
- Resolve the exact S1 and S2 tensors from the LMDB
- Apply the aforementioned Spectral Preservation Strategy
- Construct exactly 20 validated `DatasetRecord` objects
- Output `data/pilot_training.jsonl` and `data/pilot_dataset_report.json`

Your dataset must conform to the JSONL schema defined in `src/schema.py`. See `data/README.md` for details on how to structure BigEarthNet or custom datasets.

### Validation

Always validate your dataset before training:
```bash
python scripts/validate_dataset.py --dataset data/pilot_dataset.jsonl --image_root data/images/
```

### BigEarthNet v2 LMDB Pipeline Validation
To validate the 20-patch pilot using the real local BigEarthNet.txt annotations and the local S1/S2 LMDB:
```bash
python scripts/validate_bigearthnet_lmdb.py
```
*(This is a CPU-only data-pipeline check. It verifies the presence of the data, the validity of 12-band S2 and 2-band S1 tensors, and the explicit RGB composite conversions necessary for Qwen3-VL-4B.)*

## 4. Training (LoRA)

Select the configuration that matches your hardware (`small_gpu.yaml`, `normal_gpu.yaml`, `high_memory.yaml`).

### Dry Run (Testing the pipeline architecture)
```bash
python scripts/train_lora.py --config config/small_gpu.yaml --dry_run
```

### Actual Training
```bash
python scripts/train_lora.py --config config/small_gpu.yaml
```
The resulting adapter weights will be saved in `runs/<run-id>/adapter/`.

## 5. Evaluation

Evaluate the baseline model vs your new adapter:
```bash
# Baseline
python scripts/evaluate.py --base_model Qwen/Qwen3-VL-4B-Instruct --dataset data/test.jsonl

# Fine-tuned Adapter
python scripts/evaluate.py --base_model Qwen/Qwen3-VL-4B-Instruct --adapter_path runs/<run-id>/adapter --dataset data/test.jsonl
```

## 6. Integrating with Production

Once you have a successfully trained adapter in `runs/<run-id>/adapter/`, configure the Node.js production app to use it.

### IMPORTANT: Ollama Deployment
Hugging Face PEFT adapters (`.safetensors`) **cannot** be directly loaded by Ollama natively without conversion. To run your fine-tuned model completely offline via the Ollama provider:

1. **Merge the LoRA weights**: Use Hugging Face's `merge_and_unload()` to bake the adapter into the base model.
2. **Convert to GGUF**: Clone `llama.cpp` and run the conversion script `convert_hf_to_gguf.py` on your merged model.
3. **Import to Ollama**: Create a Modelfile:
   ```dockerfile
   FROM ./path/to/your/merged-qwen3-vl-4b-instruct.gguf
   TEMPLATE "{{ if .System }}<|im_start|>system\n{{ .System }}<|im_end|>\n{{ end }}{{ if .Prompt }}<|im_start|>user\n{{ .Prompt }}<|im_end|>\n{{ end }}<|im_start|>assistant\n"
   ```
4. Build the model: `ollama create SatQuery-RS-LoRA -f Modelfile`

Finally, in the root `.env` file of the Node.js app, set:
```env
OLLAMA_MODEL="SatQuery-RS-LoRA"
ADAPTER_PATH="./training/runs/<run-id>/adapter" # Keeps the execution trace honest
```
*(The production orchestrator execution trace will log `ADAPTATION_STATUS: LOADED` if this configuration is detected).*
