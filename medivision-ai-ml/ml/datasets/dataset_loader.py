from pathlib import Path
from typing import Dict, Tuple
import numpy as np
import pandas as pd
from PIL import Image, UnidentifiedImageError
import torch
from torch.utils.data import Dataset
from sklearn.model_selection import train_test_split
from .dataset_config import DatasetConfig
from .metadata import encode_metadata, validate_metadata_columns

def _add_labels_from_original_nih_csv(df: pd.DataFrame, class_names) -> pd.DataFrame:
    if "Finding Labels" not in df.columns:
        return df
    frame = df.copy()
    findings = frame["Finding Labels"].fillna("").astype(str).str.split("|")
    aliases = {
        "Normal": {"No Finding"},
        "Pleural_Effusion": {"Effusion", "Pleural Effusion", "Pleural_Effusion"},
    }
    for class_name in class_names:
        accepted = aliases.get(class_name, {class_name})
        frame[class_name] = findings.map(lambda items: int(any(item in accepted for item in items)))
    return frame

class ChestXrayDataset(Dataset):
    def __init__(self, frame, config: DatasetConfig, transform=None, require_metadata: bool = True):
        self.frame = frame.reset_index(drop=True); self.config = config; self.transform = transform; self.require_metadata = require_metadata
        if require_metadata: validate_metadata_columns(self.frame)
    def __len__(self): return len(self.frame)
    def __getitem__(self, index):
        row = self.frame.iloc[index]
        path = Path(self.config.image_root) / str(row[self.config.image_column])
        try:
            image = Image.open(path).convert("RGB")
        except (FileNotFoundError, UnidentifiedImageError, OSError) as exc:
            raise RuntimeError(f"Unable to load image '{path}': {exc}") from exc
        if self.transform: image = self.transform(image)
        target = torch.tensor(row[self.config.class_names].to_numpy(dtype=np.float32), dtype=torch.float32)
        metadata = torch.tensor(encode_metadata(row), dtype=torch.float32) if self.require_metadata else torch.empty(0, dtype=torch.float32)
        return image, metadata, target, str(path)

def load_and_validate_frame(config: DatasetConfig) -> pd.DataFrame:
    config.validate(); df = _add_labels_from_original_nih_csv(pd.read_csv(config.csv_path), config.class_names)
    required = [config.image_column, *config.class_names]
    missing = [c for c in required if c not in df.columns]
    if missing: raise ValueError(f"Dataset CSV missing required columns: {missing}")
    validate_metadata_columns(df)
    if df.empty: raise ValueError("Dataset CSV is empty")
    paths = [Path(config.image_root) / str(x) for x in df[config.image_column]]
    missing_files = [str(p) for p in paths if not p.is_file()]
    if missing_files: raise FileNotFoundError(f"Missing image files ({len(missing_files)}): {missing_files[:10]}")
    labels = df[config.class_names]
    if labels.isna().any().any(): raise ValueError("Labels contain missing values")
    bad = {c: sorted(set(labels[c].unique()) - {0, 1, 0.0, 1.0, True, False}) for c in config.class_names}
    bad = {k: v for k, v in bad.items() if v}
    if bad: raise ValueError(f"Labels must be binary 0/1 for multi-label classification: {bad}")
    for p in paths:
        try:
            with Image.open(p) as im: im.verify()
        except Exception as exc: raise ValueError(f"Invalid/corrupted image '{p}': {exc}") from exc
    return df

def split_dataframe(df: pd.DataFrame, config: DatasetConfig) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    # Patient IDs are kept in the CSV but are not model inputs. If present, split by
    # patient to prevent follow-up images from leaking between train and test sets.
    if "Patient ID" in df.columns and df["Patient ID"].nunique() >= 3:
        patients = df["Patient ID"].drop_duplicates().to_frame()
        train_patients, remainder_patients = train_test_split(patients, test_size=1-config.train_fraction, random_state=config.seed, shuffle=True)
        val_share = config.val_fraction / (config.val_fraction + config.test_fraction)
        val_patients, test_patients = train_test_split(remainder_patients, test_size=1-val_share, random_state=config.seed, shuffle=True)
        train = df[df["Patient ID"].isin(train_patients["Patient ID"])]
        val = df[df["Patient ID"].isin(val_patients["Patient ID"])]
        test = df[df["Patient ID"].isin(test_patients["Patient ID"])]
    else:
        train, remainder = train_test_split(df, test_size=1-config.train_fraction, random_state=config.seed, shuffle=True)
        val_share = config.val_fraction / (config.val_fraction + config.test_fraction)
        val, test = train_test_split(remainder, test_size=1-val_share, random_state=config.seed, shuffle=True)
    return train.reset_index(drop=True), val.reset_index(drop=True), test.reset_index(drop=True)

def class_distribution(df: pd.DataFrame, class_names) -> Dict[str, int]:
    return {c: int(df[c].sum()) for c in class_names}
