from pathlib import Path
import matplotlib.pyplot as plt
from sklearn.metrics import roc_curve

def save_roc_curves(y_true, probabilities, class_names, output_path):
    Path(output_path).parent.mkdir(parents=True, exist_ok=True); plt.figure(figsize=(8,6))
    for i, name in enumerate(class_names):
        if len(set(y_true[:,i])) > 1:
            fpr, tpr, _ = roc_curve(y_true[:,i], probabilities[:,i]); plt.plot(fpr,tpr,label=name)
    plt.plot([0,1],[0,1],'k--'); plt.xlabel('False positive rate'); plt.ylabel('True positive rate'); plt.title('ROC curves'); plt.legend(fontsize=8); plt.tight_layout(); plt.savefig(output_path, dpi=150); plt.close()

def save_confusion_matrices(metrics, output_path):
    import numpy as np
    names=list(metrics['per_class']); cols=min(4,max(1,len(names))); rows=(len(names)+cols-1)//cols
    fig, axes=plt.subplots(rows,cols,figsize=(3*cols,3*rows)); axes=np.atleast_1d(axes).ravel()
    for ax,name in zip(axes,names): ax.imshow(metrics['per_class'][name]['confusion_matrix'],cmap='Blues'); ax.set_title(name); ax.set_xlabel('Predicted'); ax.set_ylabel('Actual')
    for ax in axes[len(names):]: ax.axis('off')
    Path(output_path).parent.mkdir(parents=True,exist_ok=True); plt.tight_layout(); plt.savefig(output_path,dpi=150); plt.close(fig)
