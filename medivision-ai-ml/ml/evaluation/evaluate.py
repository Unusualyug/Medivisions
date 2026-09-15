import argparse, json
from pathlib import Path
import numpy as np, torch
from torch.utils.data import DataLoader
from ..datasets.dataset_config import DatasetConfig
from ..datasets.dataset_loader import load_and_validate_frame, split_dataframe, ChestXrayDataset
from ..datasets.metadata import metadata_dimension
from ..preprocessing.transforms import build_eval_transform
from ..models.densenet import build_densenet121
from ..training.checkpoint import load_checkpoint
from .metrics import multilabel_metrics
from .plots import save_roc_curves, save_confusion_matrices

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--csv',required=True); ap.add_argument('--image-root',default='.'); ap.add_argument('--classes',nargs='+',required=True); ap.add_argument('--model-path',default='./models/best_model.pth'); ap.add_argument('--metadata-path',default='./models/metadata.json'); ap.add_argument('--output-dir',default='./outputs/evaluation'); ap.add_argument('--batch-size',type=int,default=16); args=ap.parse_args()
    cfg=DatasetConfig(args.csv,args.image_root,'Image Index',args.classes); df=load_and_validate_frame(cfg); _,_,test=split_dataframe(df,cfg); ds=ChestXrayDataset(test,cfg,build_eval_transform()); loader=DataLoader(ds,args.batch_size,shuffle=False); device=torch.device('cuda' if torch.cuda.is_available() else 'cpu'); meta=json.loads(Path(args.metadata_path).read_text()); uses_metadata='metadata' in meta or 'metadata fusion' in meta.get('architecture',''); model=build_densenet121(len(args.classes),False,metadata_dim=meta.get('metadata',{}).get('dimension',metadata_dimension()) if uses_metadata else 0).to(device); ck=load_checkpoint(args.model_path,model,device=device); model.eval(); ys=[]; ps=[]
    with torch.no_grad():
        for x,m,y,_ in loader: ps.append(torch.sigmoid(model(x.to(device),m.to(device) if uses_metadata else None)).cpu().numpy()); ys.append(y.numpy())
    y=np.concatenate(ys); p=np.concatenate(ps); metrics=multilabel_metrics(y,p,class_names=args.classes); out=Path(args.output_dir); out.mkdir(parents=True,exist_ok=True); save_roc_curves(y,p,args.classes,out/'roc_curves.png'); save_confusion_matrices(metrics,out/'confusion_matrices.png'); result={'modelVersion':ck.get('model_version'),'metrics':metrics,'artifacts':{'rocCurves':str(out/'roc_curves.png'),'confusionMatrices':str(out/'confusion_matrices.png')}}; meta['metrics']=metrics; meta['evaluation']={'status':'complete','resultsPath':str(out/'evaluation.json')}; (out/'evaluation.json').write_text(json.dumps(result,indent=2)); Path(args.metadata_path).write_text(json.dumps(meta,indent=2)); print(json.dumps(result,indent=2))
if __name__=='__main__': main()
