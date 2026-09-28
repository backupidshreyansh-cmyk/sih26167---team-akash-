import json
import logging
from pathlib import Path
import numpy as np
from PIL import Image

try:
    import lmdb
except ImportError:
    lmdb = None

try:
    import pandas as pd
except ImportError:
    pd = None

logger = logging.getLogger(__name__)

class BigEarthNetLMDBAdapter:
    """
    Adapter to read BigEarthNet v2 LMDB and BigEarthNet.txt annotations.
    Preserves actual remote-sensing tensor information (12 S2 bands, 2 S1 bands),
    as well as annotations and metadata.
    
    LIMITATION DISCLOSURE:
    Qwen3-VL-4B is a standard Visual Language Model designed for 3-channel RGB image inputs.
    It does not possess a native specialized multispectral or SAR vision encoder (like SatMAE).
    Therefore, the `to_vlm_compatible` method explicitly converts the 12-band S2 and 2-band S1
    data into model-compatible 3-channel RGB composites (True Color / False Color).
    True end-to-end training on 14-channel raw data would require architectural changes to Qwen3-VL's
    patch embedding layer, which is outside the scope of QLoRA adaptation.
    """
    
    S2_BANDS = ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B8A', 'B09', 'B11', 'B12']
    S1_BANDS = ['VV', 'VH']

    def __init__(self, lmdb_path: str, manifest_path: str, parquet_path: str = None):
        self.lmdb_path = Path(lmdb_path)
        self.manifest_path = Path(manifest_path)
        self.parquet_path = Path(parquet_path) if parquet_path else None
        
        # Load manifest
        with open(self.manifest_path, 'r', encoding='utf-8') as f:
            self.manifest = json.load(f)
            
        # Parquet for BigEarthNet.txt annotations
        self.annotations = None
        if self.parquet_path and self.parquet_path.exists():
            if pd is not None:
                self.annotations = pd.read_parquet(self.parquet_path)
            else:
                logger.warning("pandas is required to read parquet annotations.")

        self.env = None
        if lmdb is not None and self.lmdb_path.exists():
            self.env = lmdb.open(
                str(self.lmdb_path),
                readonly=True,
                lock=False,
                readahead=False,
                meminit=False
            )
        else:
            logger.warning(f"LMDB at {lmdb_path} not found or lmdb module missing.")

    def _read_lmdb_patch(self, patch_id: str):
        if self.env is None:
            raise RuntimeError("LMDB environment is not initialized (or lmdb package missing).")
        with self.env.begin(write=False) as txn:
            import pickle
            data = txn.get(patch_id.encode('utf-8'))
            if data is None:
                raise KeyError(f"Patch {patch_id} not found in LMDB.")
            return pickle.loads(data)

    def process_s2_bands(self, s2_data: dict) -> np.ndarray:
        """
        Handles mixed native resolutions of Sentinel-2 (10m, 20m, 60m).
        Upsamples 20m (60x60) and 60m (20x20) bands to 10m (120x120) 
        using deterministic cv2 bicubic interpolation to preserve spatial correspondence.
        """
        import cv2
        target_size = (120, 120)
        
        def resize_band(band_array):
            if band_array.shape == target_size:
                return band_array
            return cv2.resize(band_array, target_size, interpolation=cv2.INTER_CUBIC)
            
        bands = []
        for b in self.S2_BANDS:
            if b not in s2_data:
                raise ValueError(f"Missing band {b} in S2 data.")
            bands.append(resize_band(s2_data[b]))
            
        return np.stack(bands, axis=-1)

    def process_s1_bands(self, s1_data: dict) -> np.ndarray:
        """
        Reads SAR VV and VH bands, preserving the original arrays.
        """
        for b in self.S1_BANDS:
            if b not in s1_data:
                raise ValueError(f"Missing {b} in S1 data.")
        return np.stack([s1_data['VV'], s1_data['VH']], axis=-1)
        
    def to_vlm_compatible(self, s2_tensor: np.ndarray, s1_tensor: np.ndarray) -> dict:
        """
        Converts the raw multispectral and SAR tensors into standard RGB formats compatible 
        with Qwen3-VL-4B, acknowledging the architectural limitation that it cannot natively 
        ingest 14 channels.
        """
        # S2 True Color Composite (B04, B03, B02 -> R, G, B)
        # Using simple normalization assuming typical S2 L2A reflectance ranges (0-10000)
        r = s2_tensor[:, :, 3]
        g = s2_tensor[:, :, 2]
        b = s2_tensor[:, :, 1]
        s2_rgb = np.stack([r, g, b], axis=-1)
        s2_rgb_norm = np.clip(s2_rgb, 0, 4000) / 4000.0 * 255.0
        s2_pil = Image.fromarray(s2_rgb_norm.astype(np.uint8))
        
        # S1 False Color Composite (R=VV, G=VH, B=VV-VH ratio pseudo-band)
        # Normalizing robustly
        vv = np.nan_to_num(s1_tensor[:, :, 0])
        vh = np.nan_to_num(s1_tensor[:, :, 1])
        
        def norm(arr):
            p2, p98 = np.percentile(arr, (2, 98))
            return np.clip((arr - p2) / (p98 - p2 + 1e-8), 0, 1)
            
        vv_norm = norm(vv)
        vh_norm = norm(vh)
        ratio_norm = norm(vv / (vh + 1e-8))
        
        s1_rgb = np.stack([vv_norm, vh_norm, ratio_norm], axis=-1) * 255.0
        s1_pil = Image.fromarray(s1_rgb.astype(np.uint8))
        
        return {
            'optical_rgb': s2_pil,
            'sar_rgb': s1_pil
        }

    def __len__(self):
        return len(self.manifest)
        
    def __getitem__(self, idx):
        record = self.manifest[idx]
        patch_id = record.get('patch_id')
        s1_name = record.get('s1_name', 'UNKNOWN_S1')
        
        # Fetch annotations if parquet exists and was successfully loaded
        metadata = {
            'labels': record.get('labels', []),
            'type': record.get('type', 'BigEarthNet_V2_Patch'),
            'lat': record.get('latitude'),
            'lon': record.get('longitude'),
            'country': record.get('country'),
            'season': record.get('season'),
            'climate_zone': record.get('climate_zone')
        }
        
        if self.annotations is not None:
            # Assumes parquet is indexed by patch_id or has it as a column
            try:
                if 'patch_id' in self.annotations.columns:
                    match = self.annotations[self.annotations['patch_id'] == patch_id]
                    if not match.empty:
                        metadata.update(match.iloc[0].to_dict())
                elif patch_id in self.annotations.index:
                    metadata.update(self.annotations.loc[patch_id].to_dict())
            except Exception as e:
                logger.debug(f"Failed to fetch metadata for {patch_id}: {e}")

        raw_data = self._read_lmdb_patch(patch_id)
        
        # Extract tensors
        s2_tensor = self.process_s2_bands(raw_data['s2'])
        s1_tensor = self.process_s1_bands(raw_data['s1'])
        
        return {
            'patch_id': patch_id,
            's1_name': s1_name,
            's2_tensor': s2_tensor,
            's1_tensor': s1_tensor,
            'metadata': metadata
        }
