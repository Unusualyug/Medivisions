import torch
import torch.nn as nn
from torchvision.models import densenet121, DenseNet121_Weights
from ..datasets.metadata import metadata_dimension

class MultimodalDenseNet121(nn.Module):
    def __init__(self, num_classes: int, metadata_dim: int, dropout: float = 0.2, pretrained: bool = True):
        super().__init__()
        backbone = densenet121(weights=DenseNet121_Weights.DEFAULT if pretrained else None)
        self.features = backbone.features
        self.image_pool = nn.AdaptiveAvgPool2d((1, 1))
        image_features = backbone.classifier.in_features
        self.metadata_encoder = nn.Sequential(
            nn.Linear(metadata_dim, 32),
            nn.ReLU(),
            nn.BatchNorm1d(32),
            nn.Dropout(dropout),
        )
        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(image_features + 32, num_classes),
        )

    def forward(self, image: torch.Tensor, metadata: torch.Tensor | None = None):
        image_features = self.features(image)
        image_features = torch.relu(image_features)
        image_features = self.image_pool(image_features).flatten(1)
        if metadata is None:
            metadata = torch.zeros((image.shape[0], self.metadata_encoder[0].in_features), device=image.device, dtype=image.dtype)
        metadata_features = self.metadata_encoder(metadata)
        return self.classifier(torch.cat([image_features, metadata_features], dim=1))

def build_densenet121(num_classes: int, pretrained: bool = True, dropout: float = 0.2, metadata_dim: int | None = None):
    # Multimodal is the default. Passing metadata_dim=0 preserves a simple
    # image-only construction for compatibility with older checkpoints.
    if metadata_dim == 0:
        weights = DenseNet121_Weights.DEFAULT if pretrained else None
        model = densenet121(weights=weights)
        in_features = model.classifier.in_features
        model.classifier = nn.Sequential(nn.Dropout(dropout), nn.Linear(in_features, num_classes))
        return model
    return MultimodalDenseNet121(num_classes, metadata_dim or metadata_dimension(), dropout, pretrained=pretrained)

def target_layer(model):
    return model.features
