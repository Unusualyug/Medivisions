from __future__ import annotations

from typing import Any, Dict, List
import numpy as np
import pandas as pd
import torch

NUMERIC_COLUMNS = [
    "Patient Age",
    "OriginalImage[Width",
    "Height]",
    "OriginalImagePixelSpacing[x",
    "y]",
]
CATEGORICAL_COLUMNS = ["Patient Sex", "View Position"]
METADATA_COLUMNS = NUMERIC_COLUMNS + CATEGORICAL_COLUMNS
CATEGORICAL_VALUES = {
    "Patient Sex": ["M", "F"],
    "View Position": ["PA", "AP"],
}


def _number(value: Any, default: float = 0.0) -> float:
    try:
        value = float(str(value).strip())
        return value if np.isfinite(value) else default
    except (TypeError, ValueError):
        return default


def metadata_dimension() -> int:
    return len(NUMERIC_COLUMNS) + sum(len(values) + 1 for values in CATEGORICAL_VALUES.values())


def encode_metadata(row: pd.Series | Dict[str, Any]) -> np.ndarray:
    values: List[float] = []
    # Stable, bounded normalizations keep the model numerically well behaved.
    values.extend([
        _number(row.get("Patient Age")) / 100.0,
        _number(row.get("OriginalImage[Width")) / 3000.0,
        _number(row.get("Height]")) / 3000.0,
        _number(row.get("OriginalImagePixelSpacing[x")) / 1.0,
        _number(row.get("y]")) / 1.0,
    ])
    for column, choices in CATEGORICAL_VALUES.items():
        value = str(row.get(column, "")).strip().upper()
        values.extend([1.0 if value == choice else 0.0 for choice in choices])
        values.append(1.0 if value not in choices else 0.0)  # explicit unknown bucket
    return np.asarray(values, dtype=np.float32)


def validate_metadata_columns(frame: pd.DataFrame) -> None:
    missing = [column for column in METADATA_COLUMNS if column not in frame.columns]
    if missing:
        raise ValueError(
            "CSV is missing metadata columns required by the multimodal model: "
            f"{missing}. Keep the original NIH CSV header, including the split dimension names."
        )


def metadata_config() -> Dict[str, Any]:
    return {
        "columns": METADATA_COLUMNS,
        "numericColumns": NUMERIC_COLUMNS,
        "categoricalColumns": CATEGORICAL_COLUMNS,
        "categoricalValues": CATEGORICAL_VALUES,
        "dimension": metadata_dimension(),
        "normalization": {"age": 100.0, "width": 3000.0, "height": 3000.0, "spacing": 1.0},
    }

def default_metadata_tensor(batch_size: int, device: torch.device) -> torch.Tensor:
    return torch.zeros((batch_size, metadata_dimension()), dtype=torch.float32, device=device)
