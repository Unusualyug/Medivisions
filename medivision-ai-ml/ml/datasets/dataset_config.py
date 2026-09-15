from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional
import os

@dataclass
class DatasetConfig:
    csv_path: str
    image_root: str = "."
    image_column: str = "image_path"
    class_names: List[str] = field(default_factory=list)
    train_fraction: float = 0.70
    val_fraction: float = 0.15
    test_fraction: float = 0.15
    dataset_version: str = "unversioned"
    seed: int = 42
    def validate(self) -> None:
        if not self.class_names: raise ValueError("class_names must contain at least one class")
        if min(self.train_fraction, self.val_fraction, self.test_fraction) <= 0: raise ValueError("split fractions must be positive")
        if abs(self.train_fraction + self.val_fraction + self.test_fraction - 1.0) > 1e-6: raise ValueError("split fractions must sum to 1")
        if len(set(self.class_names)) != len(self.class_names): raise ValueError("class_names must be unique")
        if not Path(self.csv_path).exists(): raise FileNotFoundError(f"Dataset CSV not found: {self.csv_path}")

@dataclass
class RuntimeConfig:
    model_path: str = os.getenv("MODEL_PATH", "./models/best_model.pth")
    metadata_path: str = os.getenv("METADATA_PATH", "./models/metadata.json")
    model_version: str = os.getenv("MODEL_VERSION", "v1.0")
    input_size: int = int(os.getenv("MODEL_INPUT_SIZE", "224"))
    output_dir: str = "./outputs"
    device: str = "auto"
