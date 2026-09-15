import time
import numpy as np
import torch
from ..evaluation.metrics import multilabel_metrics
from .checkpoint import save_checkpoint

def run_epoch(model, loader, criterion, device, optimizer=None):
    training=optimizer is not None; model.train(training); total=0; ys=[]; ps=[]
    for images, metadata, targets, _ in loader:
        images, metadata, targets = images.to(device), metadata.to(device), targets.to(device)
        with torch.set_grad_enabled(training): logits=model(images, metadata); loss=criterion(logits,targets)
        if training: optimizer.zero_grad(); loss.backward(); optimizer.step()
        total += loss.item()*len(images); ys.append(targets.detach().cpu().numpy()); ps.append(torch.sigmoid(logits).detach().cpu().numpy())
    y=np.concatenate(ys); p=np.concatenate(ps); return total/len(loader.dataset), multilabel_metrics(y,p), y,p

def fit(model, train_loader, val_loader, class_names, config, device, model_path, model_version='v1.0', resume_path=None):
    pos_counts=np.zeros(len(class_names)); neg_counts=np.zeros(len(class_names))
    for _,_,t,_ in train_loader: pos_counts += t.sum(0).numpy(); neg_counts += (1-t).sum(0).numpy()
    pos_weight=torch.tensor(np.divide(neg_counts,np.maximum(pos_counts,1)),dtype=torch.float32,device=device)
    criterion=torch.nn.BCEWithLogitsLoss(pos_weight=pos_weight); optimizer=torch.optim.AdamW(model.parameters(),lr=config['learning_rate'],weight_decay=config['weight_decay']); scheduler=torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer,mode='min',patience=2,factor=0.5)
    start=0; history={'train_loss':[],'val_loss':[],'train_metrics':[],'val_metrics':[]}; best=float('inf'); bad=0
    if resume_path:
        from .checkpoint import load_checkpoint
        ck=load_checkpoint(resume_path,model,optimizer,scheduler,device); start=ck['epoch']+1; history=ck.get('history',history); best=ck.get('val_loss',best)
    for epoch in range(start,config['epochs']):
        t=time.time(); tr_loss,tr_m,_,_=run_epoch(model,train_loader,criterion,device,optimizer); va_loss,va_m,_,_=run_epoch(model,val_loader,criterion,device); scheduler.step(va_loss)
        history['train_loss'].append(tr_loss); history['val_loss'].append(va_loss); history['train_metrics'].append(tr_m); history['val_metrics'].append(va_m)
        save_checkpoint(model_path+'.last',model,optimizer,scheduler,epoch,va_loss,va_m,class_names,model_version,history)
        if va_loss < best:
            best=va_loss; bad=0; save_checkpoint(model_path,model,optimizer,scheduler,epoch,va_loss,va_m,class_names,model_version,history)
        else: bad+=1
        print(f'Epoch {epoch+1}: train_loss={tr_loss:.4f} val_loss={va_loss:.4f} ({time.time()-t:.1f}s)')
        if bad >= config['patience']: break
    return history
