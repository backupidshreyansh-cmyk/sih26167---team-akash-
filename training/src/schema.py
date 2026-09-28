from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
import os

class ImageRef(BaseModel):
    path: str = Field(..., description="Path to the image file, relative to dataset root or absolute.")
    tensor_path: Optional[str] = Field(None, description="Path to the raw multispectral/SAR numpy tensor array, preserving spectral integrity.")
    modality: Literal["optical", "sar", "optical_t1", "optical_t2", "sar_t1", "sar_t2"] = Field(..., description="Modality of the image.")

class DatasetRecord(BaseModel):
    id: str = Field(..., description="Unique identifier for the record.")
    images: List[ImageRef] = Field(..., description="List of images associated with the query.")
    task_type: Literal[
        "binary_vqa", 
        "multiple_choice_vqa", 
        "captioning", 
        "grounding", 
        "spatial_reasoning", 
        "lulc_reasoning", 
        "optical_analysis", 
        "sar_analysis", 
        "optical_sar_reasoning", 
        "change_reasoning"
    ] = Field(..., description="The type of remote sensing task.")
    question: str = Field(..., description="The user's query or instruction.")
    answer: str = Field(..., description="The ground truth response.")
    choices: Optional[List[str]] = Field(None, description="Optional choices for multiple choice VQA.")
    caption: Optional[str] = Field(None, description="Optional image caption.")
    grounding_info: Optional[List[dict]] = Field(None, description="Optional bounding box info.")
    spatial_relationships: Optional[dict] = Field(None, description="Optional spatial relations.")
    geographic_info: Optional[dict] = Field(None, description="Optional geo-coordinates or EPSG.")
    metadata_ref: Optional[dict] = Field(None, description="Optional acquisition metadata.")
    source: str = Field(..., description="Source dataset name (e.g., 'BigEarthNet').")
    split: Literal["train", "val", "test", "pilot"] = Field(..., description="Dataset split.")

    @field_validator('images')
    def check_images_not_empty(cls, v):
        if len(v) == 0:
            raise ValueError("At least one image must be provided.")
        return v
