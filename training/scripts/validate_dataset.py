import json
import argparse
import sys
import os
from pathlib import Path
from pydantic import ValidationError
from tqdm import tqdm

# Add src to path so we can import schema
sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.schema import DatasetRecord

def validate_dataset(jsonl_path: str, image_root: str):
    path = Path(jsonl_path)
    if not path.exists():
        print(f"Error: Dataset file {jsonl_path} not found.")
        sys.exit(1)

    print(f"Validating dataset: {jsonl_path}")
    print(f"Image root directory: {image_root}")

    stats = {
        "total_records": 0,
        "valid_records": 0,
        "invalid_records": 0,
        "missing_images": 0,
        "tasks": {},
        "splits": {},
        "sources": set()
    }
    
    seen_ids = set()
    errors = []

    with open(path, 'r', encoding='utf-8') as f:
        for line_idx, line in enumerate(tqdm(f, desc="Validating records")):
            if not line.strip():
                continue
                
            stats["total_records"] += 1
            
            try:
                data = json.loads(line)
            except json.JSONDecodeError as e:
                errors.append(f"Line {line_idx+1}: Invalid JSON - {str(e)}")
                stats["invalid_records"] += 1
                continue
                
            try:
                record = DatasetRecord(**data)
            except ValidationError as e:
                errors.append(f"Line {line_idx+1}: Schema Validation Error for ID {data.get('id', 'UNKNOWN')} - {str(e)}")
                stats["invalid_records"] += 1
                continue

            if record.id in seen_ids:
                errors.append(f"Line {line_idx+1}: Duplicate ID found - {record.id}")
                stats["invalid_records"] += 1
                continue
            seen_ids.add(record.id)

            # Check image paths
            images_valid = True
            for img in record.images:
                img_path = Path(image_root) / img.path
                if not img_path.exists() or not img_path.is_file():
                    errors.append(f"Line {line_idx+1} [ID: {record.id}]: Missing image file - {img_path}")
                    images_valid = False
                    stats["missing_images"] += 1
            
            if not images_valid:
                stats["invalid_records"] += 1
                continue
                
            stats["valid_records"] += 1
            stats["tasks"][record.task_type] = stats["tasks"].get(record.task_type, 0) + 1
            stats["splits"][record.split] = stats["splits"].get(record.split, 0) + 1
            stats["sources"].add(record.source)

    print("\n" + "="*50)
    print("VALIDATION REPORT")
    print("="*50)
    print(f"Total records processed : {stats['total_records']}")
    print(f"Valid records           : {stats['valid_records']}")
    print(f"Invalid records         : {stats['invalid_records']}")
    print(f"Missing images          : {stats['missing_images']}")
    
    print("\nTask Distribution:")
    for t, c in stats["tasks"].items():
        print(f"  - {t}: {c}")
        
    print("\nSplit Distribution:")
    for s, c in stats["splits"].items():
        print(f"  - {s}: {c}")
        
    print("\nSources identified:")
    for s in stats["sources"]:
        print(f"  - {s}")

    if errors:
        print("\n" + "!"*50)
        print(f"CRITICAL ERRORS FOUND ({len(errors)})")
        print("!"*50)
        for e in errors[:20]:
            print(e)
        if len(errors) > 20:
            print(f"... and {len(errors) - 20} more errors.")
        sys.exit(1)
    else:
        print("\n" + "="*50)
        print("DATASET VALIDATION SUCCESSFUL.")
        print("="*50)
        sys.exit(0)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate remote sensing training dataset")
    parser.add_argument("--dataset", type=str, required=True, help="Path to JSONL dataset file")
    parser.add_argument("--image_root", type=str, default=".", help="Root directory for image paths")
    
    args = parser.parse_args()
    validate_dataset(args.dataset, args.image_root)
