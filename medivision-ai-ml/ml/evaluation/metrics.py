import numpy as np
from sklearn.metrics import roc_auc_score, precision_score, recall_score, f1_score, confusion_matrix

def _safe(fn, y, p, **kwargs):
    try: return float(fn(y, p, **kwargs))
    except ValueError: return None

def multilabel_metrics(y_true, probabilities, threshold=0.5, class_names=None):
    y_true = np.asarray(y_true).astype(int); probabilities = np.asarray(probabilities); pred = (probabilities >= threshold).astype(int)
    names = class_names or [str(i) for i in range(y_true.shape[1])]; per_class = {}
    for i, name in enumerate(names):
        tn, fp, fn, tp = confusion_matrix(y_true[:, i], pred[:, i], labels=[0,1]).ravel()
        per_class[name] = {
            "roc_auc": _safe(roc_auc_score, y_true[:,i], probabilities[:,i]),
            "precision": _safe(precision_score, y_true[:,i], pred[:,i], zero_division=0),
            "recall": _safe(recall_score, y_true[:,i], pred[:,i], zero_division=0),
            "f1": _safe(f1_score, y_true[:,i], pred[:,i], zero_division=0),
            "sensitivity": float(tp/(tp+fn)) if tp+fn else None,
            "specificity": float(tn/(tn+fp)) if tn+fp else None,
            "support": int(y_true[:,i].sum()), "confusion_matrix": [[int(tn),int(fp)],[int(fn),int(tp)]]
        }
    macro = lambda key: float(np.mean([v[key] for v in per_class.values() if v[key] is not None])) if any(v[key] is not None for v in per_class.values()) else None
    return {"threshold": threshold, "per_class": per_class, "overall": {k: macro(k) for k in ["roc_auc","precision","recall","f1","sensitivity","specificity"]}, "sample_count": int(len(y_true))}
