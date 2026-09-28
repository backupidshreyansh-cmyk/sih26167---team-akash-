# Future Model Adaptation (BigEarthNet)

## Smart India Hackathon Requirement
Problem Statement 26167 requests that the VLM component be adapted/fine-tuned using BigEarthNet or other relevant open-source datasets to improve its domain knowledge of remote-sensing scenes.

This document outlines the architecture for integrating an explicitly adapted model into the existing local-first application. 

**IMPORTANT**: Currently, the system utilizes prompt-based system instructions acting as a zero-shot constraint layer over a base VLM (Qwen3-VL/Gemini). No physical fine-tuning weights are included in this repository to keep the application lightweight and directly runnable without requiring massive GPU training clusters.

## Adaptation Strategy

1. **Dataset**: BigEarthNet.txt (or full image/patch datasets) provides multi-label land-cover annotations across Sentinel-1 (SAR) and Sentinel-2 (Optical) imagery.
2. **Task Types**:
    *   Image Captioning
    *   Land Cover Classification
    *   Cross-Modal Optical/SAR Translation
3. **Training Approach**: 
    *   Parameter-Efficient Fine-Tuning (PEFT) using LoRA (Low-Rank Adaptation) on the Vision-Language Model.
    *   This ensures the base model retains its general conversational capability while developing specialized remote-sensing vocabulary and feature recognition.
4. **Where to Train**: 
    *   Training should occur on a dedicated GPU cluster or cloud instance (e.g., RunPod, AWS EC2, or Google Cloud Vertex AI) using frameworks like `peft`, `transformers`, and `trl`.
5. **Where to Store**:
    *   The resulting LoRA adapters (which are typically small, <100MB) can be hosted locally or downloaded directly into the application's environment.

## Integration Architecture

When a fine-tuned model is ready, it will be integrated via the `AIProvider` interface. The `LocalOllamaProvider` can seamlessly switch to the adapted model by simply updating the `OLLAMA_MODEL` environment variable.

1. **Convert to GGUF**: Convert the LoRA + Base Model into a quantized `.gguf` file (e.g., using `llama.cpp`).
2. **Import to Ollama**: Create a `Modelfile`:
   \`\`\`dockerfile
   FROM ./qwen3-vl-4b-instruct.gguf
   ADAPTER ./bigearthnet-lora.gguf
   TEMPLATE """..."""
   \`\`\`
3. **Deploy**: Run `ollama create SatQueryVLM -f Modelfile`
4. **Connect**: Set `OLLAMA_MODEL="SatQueryVLM"` in `.env`.

The orchestrator and tool registry remain completely unchanged, immediately taking advantage of the improved physical understanding.
