import json
import logging
from pathlib import Path
from PIL import Image
from torch.utils.data import Dataset
from .schema import DatasetRecord

logger = logging.getLogger(__name__)

class QwenVLDataset(Dataset):
    """
    A PyTorch Dataset that loads JSONL records mapping to Qwen3-VL multimodal format.
    """
    def __init__(self, jsonl_path: str, image_root: str):
        self.image_root = Path(image_root)
        self.records = []
        
        with open(jsonl_path, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip():
                    continue
                data = json.loads(line)
                # Validates via Pydantic
                self.records.append(DatasetRecord(**data))
                
        logger.info(f"Loaded {len(self.records)} records from {jsonl_path}")

    def __len__(self):
        return len(self.records)

    def __getitem__(self, idx):
        record = self.records[idx]
        
        # 1. Load actual physical images
        loaded_images = []
        for img_ref in record.images:
            img_path = self.image_root / img_ref.path
            if not img_path.exists():
                raise FileNotFoundError(f"Image missing: {img_path}")
            
            # Open and ensure RGB to avoid RGBA/Luma channel issues with the Vision Encoder
            image = Image.open(img_path).convert('RGB')
            loaded_images.append(image)
            
        # 2. Construct Qwen3-VL Content Array
        # Qwen requires explicit vision tokens in the content array alongside text.
        content = []
        
        # Inject images into prompt based on modality
        for i, img_ref in enumerate(record.images):
            # Qwen-VL-Utils expects PIL images directly in the content block
            content.append({"type": "image", "image": loaded_images[i]})
            
        # Append the textual instruction/question
        content.append({"type": "text", "text": record.question})

        # 3. Create the chat completion messages format
        messages = [
            {
                "role": "user",
                "content": content
            },
            {
                "role": "assistant",
                "content": [
                    {"type": "text", "text": record.answer}
                ]
            }
        ]
        
        return {
            "id": record.id,
            "messages": messages,
            "task_type": record.task_type
        }
