# BigEarthNet.txt Adaptation Pipeline

## 1. What is BigEarthNet.txt?
BigEarthNet is a large-scale archive of Sentinel-1 and Sentinel-2 remote sensing images annotated with multi-labels.
BigEarthNet.txt is an extension of this dataset designed explicitly to train and adapt Vision-Language Models (VLMs) by mapping complex co-registered SAR/Optical features into natural-language semantic annotations.

## 2. Why is it Useful for VLM Adaptation?
Generic foundation models (like Gemini or LLaVa) are trained on natural images (dogs, cars, buildings viewed horizontally). They struggle natively with:
- **Overhead perspective**: Recognizing shapes purely from top-down spatial features.
- **Spectral properties**: Understanding the meaning of False Color infrared composites.
- **SAR characteristics**: Interpreting backscatter, layover, and shadowing from C-band synthetic aperture radar.

BigEarthNet.txt bridges this gap. It provides supervised examples of how pixel-level multispectral and SAR intensity mappings translate to human-readable land-cover semantics (e.g., "Mixed forest with patches of arable land").

## 3. Which Tasks Does it Support?
Training on this data structure unlocks:
- **Remote Sensing VQA**: Accurately answering text queries about satellite imagery.
- **Scene Captioning**: Generating comprehensive descriptions of multi-label tiles.
- **Spatial Reasoning**: Understanding how regions are physically distributed across a tile.
- **Cross-Modal Alignment**: Teaching the model that the smooth, dark region in a SAR VV polarization map corresponds to the water body visible in the optical bands.

## 4. Distinguishing Adaptation vs. Evaluation
* **Adaptation (Training) Data**: The dataset used to generate the LoRA/PEFT weights. (BigEarthNet.txt).
* **Evaluation Data (Hidden ISRO dataset)**: To ensure robustness, the final system is intended to be evaluated against hidden datasets (such as Cartosat/RISAT derivatives or specialized ISRO validation sets).

**IMPORTANT ARCHITECTURAL COMMITMENT**:
Our system uses BigEarthNet.txt to learn **sensor-agnostic evidence abstraction**. We do not hardcode the model to expect only Sentinel formats. By separating the image ingestion metadata pipeline from the language-reasoning module, the system remains adaptable to high-resolution Cartosat or RISAT imagery during the evaluation phase.
