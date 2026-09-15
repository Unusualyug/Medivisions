from pathlib import Path
import torch

def save_checkpoint(path, model, optimizer, scheduler, epoch, val_loss, metrics, class_names, model_version, history):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    torch.save({'model_state': model.state_dict(), 'optimizer_state': optimizer.state_dict() if optimizer else None, 'scheduler_state': scheduler.state_dict() if scheduler else None, 'epoch': epoch, 'val_loss': val_loss, 'metrics': metrics, 'class_names': class_names, 'model_version': model_version, 'history': history}, path)

def load_checkpoint(path, model, optimizer=None, scheduler=None, device='cpu'):
    if not Path(path).is_file(): raise FileNotFoundError(f"Checkpoint not found: {path}")
    ckpt=torch.load(path,map_location=device,weights_only=False); model.load_state_dict(ckpt['model_state'])
    if optimizer and ckpt.get('optimizer_state'): optimizer.load_state_dict(ckpt['optimizer_state'])
    if scheduler and ckpt.get('scheduler_state'): scheduler.load_state_dict(ckpt['scheduler_state'])
    return ckpt
