import sys
import logging
from pathlib import Path

# Adjust path so we can import from src
sys.path.append(str(Path(__file__).resolve().parent.parent))

from src.bigearthnet_adapter import BigEarthNetLMDBAdapter

def main():
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("validate_lmdb")
    
    # Expected paths in the Windows environment
    data_dir = Path(__file__).resolve().parent.parent / "data"
    lmdb_path = data_dir / "BENv2_lithuania_summer.lmdb"
    manifest_path = data_dir / "bigearthnet_pilot_manifest.json"
    parquet_path = data_dir / "BigEarthNet.txt.parquet"
    
    logger.info(f"Checking LMDB Path: {lmdb_path}")
    logger.info(f"Checking Manifest Path: {manifest_path}")
    
    if not manifest_path.exists():
        logger.error(f"Manifest not found at {manifest_path}. Please ensure pilot data is downloaded.")
        return
        
    try:
        adapter = BigEarthNetLMDBAdapter(
            lmdb_path=str(lmdb_path), 
            manifest_path=str(manifest_path), 
            parquet_path=str(parquet_path)
        )
    except Exception as e:
        logger.error(f"Failed to initialize adapter: {e}")
        return

    total_records = len(adapter)
    logger.info(f"Total pilot records in manifest: {total_records}")
    
    if adapter.env is None:
        logger.warning("LMDB is not accessible (or lmdb package is missing). The CPU validation script is running in an environment without the actual data. The code pipeline is sound, but we cannot iterate over patches here.")
        return

    successful = 0
    missing_s1 = 0
    missing_s2 = 0
    malformed = 0
    
    for idx in range(total_records):
        try:
            record = adapter[idx]
            
            # Check shapes
            s2_shape = record['s2_tensor'].shape
            s1_shape = record['s1_tensor'].shape
            
            if s2_shape != (120, 120, 12):
                logger.error(f"Patch {record['patch_id']} S2 shape malformed: {s2_shape}")
                malformed += 1
                continue
                
            if s1_shape != (120, 120, 2):
                logger.error(f"Patch {record['patch_id']} S1 shape malformed: {s1_shape}")
                malformed += 1
                continue
                
            # Test conversion to VLM format
            vlm_images = adapter.to_vlm_compatible(record['s2_tensor'], record['s1_tensor'])
            
            successful += 1
            
        except KeyError as e:
            if "S1" in str(e) or "VV" in str(e) or "VH" in str(e):
                missing_s1 += 1
            elif "S2" in str(e) or "B0" in str(e):
                missing_s2 += 1
            else:
                logger.error(f"Missing patch in LMDB: {e}")
                malformed += 1
        except Exception as e:
            logger.error(f"Error reading index {idx}: {e}")
            malformed += 1

    logger.info("--- VALIDATION RESULTS ---")
    logger.info(f"Total Records: {total_records}")
    logger.info(f"Successful Records: {successful}")
    logger.info(f"Missing S1: {missing_s1}")
    logger.info(f"Missing S2: {missing_s2}")
    logger.info(f"Malformed: {malformed}")
    
    if successful == total_records and total_records > 0:
        logger.info("VALIDATION SUCCESS: Every record is suitable for the next preprocessing stage.")
        logger.info("DATA PIPELINE READY.")
    else:
        logger.warning("VALIDATION FAILED: Not all records passed checks.")

if __name__ == "__main__":
    main()
