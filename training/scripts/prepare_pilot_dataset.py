import os
import sys
import json
import logging
import argparse
from pathlib import Path
import numpy as np
from PIL import Image

# Adjust path so we can import from src
sys.path.append(str(Path(__file__).resolve().parent.parent))

from src.bigearthnet_adapter import BigEarthNetLMDBAdapter
from src.schema import DatasetRecord, ImageRef

logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="Prepare Pilot Dataset from BigEarthNet LMDB")
    parser.add_argument("--mock_if_missing", action="store_true", help="Generate mock data if real LMDB is missing (for CI/validation only)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    
    data_dir = Path(__file__).resolve().parent.parent / "data"
    lmdb_path = data_dir / "BENv2_lithuania_summer.lmdb"
    manifest_path = data_dir / "bigearthnet_pilot_manifest.json"
    parquet_path = data_dir / "BigEarthNet.txt.parquet"
    
    out_images_dir = data_dir / "images"
    out_tensors_dir = data_dir / "tensors"
    out_images_dir.mkdir(parents=True, exist_ok=True)
    out_tensors_dir.mkdir(parents=True, exist_ok=True)
    
    out_jsonl = data_dir / "pilot_training.jsonl"
    out_report = data_dir / "pilot_dataset_report.json"

    # If running in CI without the actual LMDB, we can optionally mock the 20 records
    is_mocked_run = False
    if not lmdb_path.exists() and args.mock_if_missing:
        logger.warning("Real LMDB missing. Running in MOCK mode to generate artifacts for CI/CD.")
        is_mocked_run = True
        if not manifest_path.exists():
            mock_manifest = [{"patch_id": f"mock_patch_{i}", "s1_name": f"mock_s1_{i}"} for i in range(20)]
            with open(manifest_path, 'w') as f:
                json.dump(mock_manifest, f)
    elif not manifest_path.exists():
        logger.error(f"Manifest not found: {manifest_path}")
        sys.exit(1)

    try:
        adapter = BigEarthNetLMDBAdapter(str(lmdb_path), str(manifest_path), str(parquet_path))
    except Exception as e:
        if is_mocked_run:
            adapter = None
        else:
            logger.error(f"Failed to initialize adapter: {e}")
            sys.exit(1)

    manifest_len = len(adapter) if adapter else 20
    if manifest_len != 20:
        logger.error(f"Manifest contains {manifest_len} records, expected exactly 20 for the pilot.")
        sys.exit(1)

    records = []
    task_counts = {}
    category_counts = {}
    successful = 0
    failures = 0

    with open(out_jsonl, 'w', encoding='utf-8') as f_out:
        for idx in range(manifest_len):
            try:
                if not is_mocked_run:
                    record_data = adapter[idx]
                    patch_id = record_data['patch_id']
                    s1_name = record_data['s1_name']
                    s2_tensor = record_data['s2_tensor']
                    s1_tensor = record_data['s1_tensor']
                    meta = record_data['metadata']
                    
                    vlm_imgs = adapter.to_vlm_compatible(s2_tensor, s1_tensor)
                    opt_rgb = vlm_imgs['optical_rgb']
                    sar_rgb = vlm_imgs['sar_rgb']
                else:
                    # Mock data generation for CI execution
                    patch_id = f"mock_patch_{idx}"
                    s1_name = f"mock_s1_{idx}"
                    s2_tensor = np.zeros((120, 120, 12), dtype=np.uint16)
                    s1_tensor = np.zeros((120, 120, 2), dtype=np.float32)
                    opt_rgb = Image.new('RGB', (120, 120), color='red')
                    sar_rgb = Image.new('RGB', (120, 120), color='blue')
                    
                    # Distribute mock task types evenly to satisfy requirements
                    task_types = ["binary_vqa", "multiple_choice_vqa", "captioning", "grounding"]
                    t_type = task_types[idx % 4]
                    meta = {
                        'task_type': t_type,
                        'question': f"Mock question {idx}",
                        'answer': "Mock answer",
                        'category': "Forest",
                        'lat': 55.0,
                        'lon': 24.0,
                        'country': "Lithuania",
                        'season': "Summer",
                        'climate_zone': "Dfb",
                        'bboxes': [{"ymin": 100, "xmin": 100, "ymax": 200, "xmax": 200, "label": "tree"}] if t_type == "grounding" else []
                    }

                # Save raw tensors for spectral preservation
                s2_npy_path = out_tensors_dir / f"{patch_id}_s2.npy"
                s1_npy_path = out_tensors_dir / f"{patch_id}_s1.npy"
                np.save(s2_npy_path, s2_tensor)
                np.save(s1_npy_path, s1_tensor)

                # Save RGB for VLM
                s2_img_path = out_images_dir / f"{patch_id}_s2_rgb.jpg"
                s1_img_path = out_images_dir / f"{patch_id}_s1_rgb.jpg"
                opt_rgb.save(s2_img_path)
                sar_rgb.save(s1_img_path)

                # Extract authoritative fields
                task_type = meta.get('task_type', 'lulc_reasoning')
                category = meta.get('category', 'unknown')
                
                task_counts[task_type] = task_counts.get(task_type, 0) + 1
                category_counts[category] = category_counts.get(category, 0) + 1

                # Construct Schema Object
                record = DatasetRecord(
                    id=patch_id,
                    images=[
                        ImageRef(
                            path=f"data/images/{s2_img_path.name}",
                            tensor_path=f"data/tensors/{s2_npy_path.name}",
                            modality="optical"
                        ),
                        ImageRef(
                            path=f"data/images/{s1_img_path.name}",
                            tensor_path=f"data/tensors/{s1_npy_path.name}",
                            modality="sar"
                        )
                    ],
                    task_type=task_type,
                    question=meta.get('question', f"Analyze patch {patch_id}."),
                    answer=meta.get('answer', ", ".join(meta.get('labels', []))),
                    choices=meta.get('choices'),
                    caption=meta.get('caption'),
                    grounding_info=meta.get('bboxes') or meta.get('grounding_info'),
                    geographic_info={
                        "lat": meta.get('lat'),
                        "lon": meta.get('lon'),
                        "country": meta.get('country'),
                        "season": meta.get('season'),
                        "climate_zone": meta.get('climate_zone'),
                    },
                    source="BigEarthNet.txt",
                    split="pilot"
                )

                f_out.write(record.model_dump_json() + "\n")
                successful += 1

            except Exception as e:
                logger.error(f"Failed processing index {idx}: {e}")
                failures += 1

    report = {
        "unique_patches": successful,
        "training_records_generated": successful,
        "counts_by_task_type": task_counts,
        "counts_by_category": category_counts,
        "s1_s2_records_complete": successful,
        "failures": failures,
        "source_files": {
            "lmdb": str(lmdb_path),
            "manifest": str(manifest_path),
            "parquet": str(parquet_path)
        },
        "is_mocked_run": is_mocked_run
    }

    with open(out_report, 'w') as f:
        json.dump(report, f, indent=4)

    logger.info(f"Dataset preparation complete. Success: {successful}, Failures: {failures}")
    logger.info(f"Generated JSONL: {out_jsonl}")
    logger.info(f"Generated Report: {out_report}")
    
    if failures > 0:
        logger.error("Some records failed. Failing loudly.")
        sys.exit(1)

if __name__ == "__main__":
    main()
