from pathlib import Path
import cv2, numpy as np, torch
from PIL import Image
from ..preprocessing.image_preprocessing import open_valid_image

class GradCAM:
    def __init__(self, predictor):
        self.predictor=predictor; self.activations=None; self.gradients=None
        layer=predictor.model.features
        layer.register_forward_hook(lambda _,__,out: setattr(self,'activations',out))
        layer.register_full_backward_hook(lambda _,gin,gout: setattr(self,'gradients',gout[0]))
    def generate(self, source, finding, output_dir, study_id=None):
        if finding not in self.predictor.classes: raise ValueError(f"Unknown finding '{finding}'. Choose one of {self.predictor.classes}")
        image=open_valid_image(source); tensor=self.predictor.transform(image).unsqueeze(0).to(self.predictor.device); self.predictor.model.zero_grad()
        logits=self.predictor.model(tensor); idx=self.predictor.classes.index(finding); logits[0,idx].backward()
        weights=self.gradients.mean(dim=(2,3),keepdim=True); cam=(weights*self.activations).sum(1).squeeze().detach().cpu().numpy(); cam=np.maximum(cam,0); cam/=cam.max()+1e-8
        original=np.array(image); processed=np.array(image.resize((self.predictor.input_size,self.predictor.input_size)))
        heat=cv2.applyColorMap(np.uint8(255*cv2.resize(cam,(original.shape[1],original.shape[0]))),cv2.COLORMAP_JET); overlay=cv2.addWeighted(cv2.cvtColor(original,cv2.COLOR_RGB2BGR),0.55,heat,0.45,0)
        out=Path(output_dir); out.mkdir(parents=True,exist_ok=True); stem=study_id or Path(str(source)).stem
        original_path=out/f'{stem}_original.png'; processed_path=out/f'{stem}_processed.png'; heat_path=out/f'{stem}_{finding}_heatmap.png'; overlay_path=out/f'{stem}_{finding}_overlay.png'
        Image.fromarray(original).save(original_path); Image.fromarray(processed).save(processed_path); cv2.imwrite(str(heat_path),heat); cv2.imwrite(str(overlay_path),overlay)
        return {'studyId':study_id,'finding':finding,'paths':{'original':str(original_path),'processed':str(processed_path),'heatmap':str(heat_path),'overlay':str(overlay_path)},'disclaimer':'Grad-CAM highlights image regions that influenced the model prediction. It is not a clinical localization or proof of disease.'}
