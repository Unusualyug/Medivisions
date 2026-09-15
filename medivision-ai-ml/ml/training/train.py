import argparse, json, random
from pathlib import Path
import numpy as np, pandas as pd, torch
from torch.utils.data import DataLoader
from ..datasets.dataset_config import DatasetConfig
from ..datasets.dataset_loader import load_and_validate_frame, split_dataframe, ChestXrayDataset, class_distribution
from ..datasets.metadata import metadata_config, metadata_dimension
from ..preprocessing.transforms import build_train_transform, build_eval_transform
from ..models.densenet import build_densenet121
from .trainer import fit

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--csv',required=True); ap.add_argument('--image-root',default='.'); ap.add_argument('--classes',nargs='+',required=True); ap.add_argument('--model-path',default='./models/best_model.pth'); ap.add_argument('--metadata-path',default='./models/metadata.json'); ap.add_argument('--dataset-version',default='unversioned'); ap.add_argument('--epochs',type=int,default=20); ap.add_argument('--batch-size',type=int,default=16); ap.add_argument('--workers',type=int,default=2); ap.add_argument('--resume'); ap.add_argument('--seed',type=int,default=42); args=ap.parse_args()
    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    cfg=DatasetConfig(args.csv,args.image_root,'Image Index',args.classes,dataset_version=args.dataset_version,seed=args.seed); df=load_and_validate_frame(cfg); train,val,test=split_dataframe(df,cfg); device=torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    tr=ChestXrayDataset(train,cfg,build_train_transform()); va=ChestXrayDataset(val,cfg,build_eval_transform()); tl=DataLoader(tr,args.batch_size,shuffle=True,num_workers=args.workers,pin_memory=torch.cuda.is_available()); vl=DataLoader(va,args.batch_size,shuffle=False,num_workers=args.workers,pin_memory=torch.cuda.is_available())
    model=build_densenet121(len(args.classes),pretrained=True,metadata_dim=metadata_dimension()).to(device); history=fit(model,tl,vl,args.classes,{'epochs':args.epochs,'learning_rate':1e-4,'weight_decay':1e-4,'patience':5},device,args.model_path,'v2.0-multimodal',args.resume)
    Path(args.metadata_path).parent.mkdir(parents=True,exist_ok=True); Path(args.metadata_path).write_text(json.dumps({'version':'v2.0-multimodal','architecture':'DenseNet121 + metadata fusion','datasetVersion':args.dataset_version,'inputSize':224,'numberOfClasses':len(args.classes),'classNames':args.classes,'imageColumn':'Image Index','labelSourceColumn':'Finding Labels','metadata':metadata_config(),'excludedIdentifiers':['Image Index','Patient ID','Follow-up #'],'trainingDate':pd.Timestamp.utcnow().isoformat(),'numberOfEpochs':len(history['train_loss']),'datasetSizes':{'total':len(df),'train':len(train),'validation':len(val),'test':len(test)},'metrics':{},'evaluation':{'status':'not_evaluated','message':'Run evaluation on a held-out patient-level test set to calculate metrics.'}},indent=2))
if __name__=='__main__': main()
