import os, tempfile, time, base64
from pathlib import Path
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from pydantic import BaseModel
import requests
from ..inference.predictor import Predictor
from ..explainability.gradcam import GradCAM

MODEL_PATH=os.getenv('MODEL_PATH','./models/best_model.pth'); METADATA_PATH=os.getenv('METADATA_PATH','./models/metadata.json'); OUTPUT_DIR=os.getenv('OUTPUT_DIR','./outputs')
app=FastAPI(title='MediVision AI ML Service', version='1.0.0'); predictor=None; gradcam=None

def get_predictor():
    global predictor,gradcam
    if predictor is None:
        predictor=Predictor(MODEL_PATH,METADATA_PATH,os.getenv('DEVICE','auto')); gradcam=GradCAM(predictor)
    return predictor
class PredictRequest(BaseModel):
    imageUrl: str
    studyId: str | None = None
    threshold: float = 0.5
    metadata: dict[str, object] | None = None
@app.get('/health')
def health():
    try: p=get_predictor(); return {'status':'ok','model':'DenseNet121','version':p.metadata.get('version')}
    except Exception as exc: return {'status':'error','model':'DenseNet121','error':str(exc)}
@app.post('/predict')
def predict(req: PredictRequest):
    tmp=None
    try:
        r=requests.get(req.imageUrl,timeout=30); r.raise_for_status(); f=tempfile.NamedTemporaryFile(suffix='.img',delete=False); f.write(r.content); f.close(); tmp=f.name
        return get_predictor().predict(tmp,req.studyId,req.threshold,req.metadata)
    except Exception as exc: raise HTTPException(status_code=422,detail={'code':'PREDICTION_FAILED','message':str(exc)})
    finally:
        if tmp: Path(tmp).unlink(missing_ok=True)
@app.post('/gradcam')
async def gradcam_endpoint(image: UploadFile=File(...), studyId: str|None=Form(None), finding: str=Form(...)):
    tmp=None
    try:
        suffix=Path(image.filename or '.img').suffix or '.img'; f=tempfile.NamedTemporaryFile(suffix=suffix,delete=False); f.write(await image.read()); f.close(); tmp=f.name
        get_predictor()
        result = gradcam.generate(tmp,finding,OUTPUT_DIR,studyId)
        images = {}
        for key, path in result['paths'].items():
            with open(path, 'rb') as fp:
                images[key] = base64.b64encode(fp.read()).decode('utf-8')
        result['images'] = images
        return result
    except Exception as exc: raise HTTPException(status_code=422,detail={'code':'GRADCAM_FAILED','message':str(exc)})
    finally:
        if tmp: Path(tmp).unlink(missing_ok=True)