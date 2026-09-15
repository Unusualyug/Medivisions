from pathlib import Path
import json, time
import torch
from PIL import Image
from ..models.densenet import build_densenet121
from ..datasets.metadata import encode_metadata, metadata_dimension
from ..preprocessing.transforms import build_eval_transform
from ..preprocessing.image_preprocessing import open_valid_image
from ..training.checkpoint import load_checkpoint

class Predictor:
    def __init__(self, model_path, metadata_path, device='auto'):
        self.device=torch.device('cuda' if device=='auto' and torch.cuda.is_available() else ('cpu' if device=='auto' else device))
        if not Path(model_path).is_file(): raise FileNotFoundError(f"Trained model weights are required but missing: {model_path}")
        if not Path(metadata_path).is_file(): raise FileNotFoundError(f"Model metadata is required but missing: {metadata_path}")
        self.metadata=json.loads(Path(metadata_path).read_text()); self.classes=self.metadata['classNames']; self.input_size=self.metadata.get('inputSize',224)
        self.uses_metadata = self.metadata.get('architecture','').endswith('metadata fusion') or 'metadata' in self.metadata
        metadata_dim = self.metadata.get('metadata', {}).get('dimension', metadata_dimension()) if self.uses_metadata else 0
        self.model=build_densenet121(len(self.classes),pretrained=False,metadata_dim=metadata_dim).to(self.device); load_checkpoint(model_path,self.model,device=self.device); self.model.eval(); self.transform=build_eval_transform(self.input_size)
    def predict(self, source, study_id=None, threshold=0.5, metadata=None):
        start=time.time(); image=open_valid_image(source); tensor=self.transform(image).unsqueeze(0).to(self.device)
        metadata_tensor = None
        if self.uses_metadata:
            metadata_tensor = torch.tensor(encode_metadata(metadata or {}), dtype=torch.float32, device=self.device).unsqueeze(0)
        with torch.no_grad(): probs=torch.sigmoid(self.model(tensor, metadata_tensor)).cpu().numpy()[0]
        return {'studyId':study_id,'model':self.metadata.get('architecture','DenseNet121'),'modelVersion':self.metadata.get('version'),'predictions':[{'finding':c,'probability':float(p),'positive':bool(p>=threshold)} for c,p in zip(self.classes,probs)],'processing':{'success':True,'durationMs':round((time.time()-start)*1000,2)},'metadataUsed':self.uses_metadata}
