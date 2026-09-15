# MediVision AI ML Component

Standalone Python/PyTorch multi-label chest X-ray research component. It uses **DenseNet121 transfer learning**, sigmoid outputs, and `BCEWithLogitsLoss`; it does not contain frontend, Node.js, MongoDB, authentication, or business logic.

## Dataset contract

The preferred CSV is the original NIH-style CSV with `Image Index`, `Finding Labels`, and the original metadata columns such as age, sex, view position, image dimensions, and pixel spacing. The loader keeps all original columns, derives binary label columns from `Finding Labels`, and uses image pixels plus safe metadata (`Patient Age`, `Patient Sex`, `View Position`, dimensions, and pixel spacing). Identifiers (`Image Index`, `Patient ID`, and `Follow-up #`) are retained for traceability but excluded from model inputs. Splits are patient-level when `Patient ID` is available, preventing follow-up images from leaking across train/validation/test. If the CSV has already been converted, it must still include the metadata columns required by the multimodal model.

## Install and train

```bash
cd medivision-ai-ml
# python -m venv .venv && . .venv/bin/activate
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
python -m ml.training.train --csv data/labels.csv --image-root data/images --classes Normal Pneumonia Cardiomegaly Pleural_Effusion --epochs 20
```

Training writes `models/best_model.pth`, an interrupt-safe `models/best_model.pth.last`, and metadata. Resume with `--resume models/best_model.pth.last`. No metric is claimed before evaluation.

## Evaluate

```bash
python -m ml.evaluation.evaluate --csv data/labels.csv --image-root data/images --classes Normal Pneumonia Cardiomegaly Pleural_Effusion
```

This writes structured `outputs/evaluation/evaluation.json`, ROC curves, confusion matrices, and updates metadata with actual held-out metrics. Metrics include per-class and macro ROC-AUC, precision, recall/sensitivity, specificity, and F1.

## Service

```bash
MODEL_PATH=./models/best_model.pth METADATA_PATH=./models/metadata.json uvicorn ml.service.app:app --host 0.0.0.0 --port 8001

# uvicorn only starts the web/API server. It does not automatically know which trained model to load.
```

Endpoints: `GET /health`, `POST /predict` with JSON `{ "imageUrl": "...", "studyId": "..." }`, and `POST /gradcam` multipart fields `image`, `studyId`, and `finding`. Prediction probabilities are model outputs, not diagnoses. Grad-CAM is an explanation aid, not clinical localization.

## Important limitations

This is an educational/research prototype and is **not clinically validated**. It must not be used for medical decision-making. A trained checkpoint is required; the service refuses to fabricate predictions when weights or metadata are missing.

---

# || MEDIVISION ||

## Model Training and Resume Training

### Problem

When we train the model, the training process takes a significant amount of time. If the laptop is shut down, restarted, or the training process is interrupted for any reason, the training may stop.

Without a checkpoint/resume mechanism, we would have to start the model training again from **Epoch 1**, which wastes the training time already completed.

### Solution

To solve this problem, we use the `trainer.py` training system with a **checkpoint and resume mechanism**.

The training process automatically maintains a latest checkpoint file:

```text
models/best_model.pth.last
```

This checkpoint allows us to continue training from where the previous training session stopped.

---

## 1. Start New Training

To start the model training from the beginning, run:

```bash
python -m ml.training.train --csv data/labels.csv --image-root data/images --classes Normal Pneumonia Cardiomegaly Pleural_Effusion --epochs 20
```

This starts the training for **20 epochs**.

For example:

```text
Epoch 1
Epoch 2
Epoch 3
...
Epoch 20
```

---

## 2. Resume Interrupted Training

If the laptop shuts down or the training process is interrupted, we do **not** need to start the training again from Epoch 1.

Instead, run:

```bash
python -m ml.training.train --csv data/labels.csv --image-root data/images --classes Normal Pneumonia Cardiomegaly Pleural_Effusion --epochs 20 --resume models/best_model.pth.last
```

The important addition is:

```text
--resume models/best_model.pth.last
```

This tells the training program to load the latest available checkpoint and continue training from the point where it stopped.

---

## 3. What is `models/best_model.pth.last`?

```text
models/best_model.pth.last
```

This is the **latest training checkpoint**.

It contains important information required to continue training, including:

- Model weights
- Optimizer state
- Learning-rate scheduler state
- Current epoch
- Validation loss
- Training history

Because this information is saved, the training process can continue without losing the progress already completed.

---

## 4. Example of Interrupted Training

Suppose we start training with:

```bash
python -m ml.training.train --csv data/labels.csv --image-root data/images --classes Normal Pneumonia Cardiomegaly Pleural_Effusion --epochs 20
```

The model successfully completes:

```text
Epoch 1
Epoch 2
Epoch 3
Epoch 4
```

Then the laptop shuts down.

The latest checkpoint contains the training progress up to the last completed epoch.

After restarting the laptop/environment, run:

```bash
python -m ml.training.train --csv data/labels.csv --image-root data/images --classes Normal Pneumonia Cardiomegaly Pleural_Effusion --epochs 20 --resume models/best_model.pth.last
```

The program loads:

```text
models/best_model.pth.last
```

and continues training from the **next epoch**.

Therefore:

```text
Epoch 1 → Completed
Epoch 2 → Completed
Epoch 3 → Completed
Epoch 4 → Completed
Laptop shuts down
       ↓
Resume training
       ↓
Epoch 5 → Continues
Epoch 6
Epoch 7
...
Epoch 20
```

---

## 5. Important Note

The system **does not create a separate checkpoint file for every epoch**.

It repeatedly updates a single latest-checkpoint file:

```text
models/best_model.pth.last
```

For example, the same file is updated as training progresses:

```text
After Epoch 1 → best_model.pth.last
After Epoch 2 → best_model.pth.last
After Epoch 3 → best_model.pth.last
After Epoch 4 → best_model.pth.last
```

The file always represents the **latest saved training state**.

---

## 6. Best Model Checkpoint

The best-performing model is stored separately:

```text
models/best_model.pth
```

The difference is:

| File                         | Purpose                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `models/best_model.pth.last` | Latest checkpoint used to **resume interrupted training** |
| `models/best_model.pth`      | **Best-performing model** based on validation performance |

### In simple terms

```text
best_model.pth.last
        ↓
"Where did my training stop?"
        ↓
Used to RESUME training


best_model.pth
        ↓
"Which model performed the best?"
        ↓
Used as the BEST trained model
```

## Final Workflow

### First time:

```bash
python -m ml.training.train --csv data/labels.csv --image-root data/images --classes Normal Pneumonia Cardiomegaly Pleural_Effusion --epochs 10 --workers 0
```

### If training is interrupted:

````bash
python -m ml.training.train --csv data/labels.csv --image-root data/images --classes Normal Pneumonia Cardiomegaly Pleural_Effusion --epochs 10 --workers 0 --resume models/best_model.pth.last
```

This allows the MEDIVISION model training process to **continue from the saved checkpoint instead of restarting from Epoch 1**.
````

<!-- Linux is generally more convenient and often more efficient than Windows for machine-learning/data-training workloads, especially when using GPU acceleration and multiprocessing. -->

# DataLoader Workers and Training Stability

## Understanding Model Training Crashes

A training crash does **not necessarily mean that the machine-learning model is wrong**.

During training, a crash can occur in different parts of the training pipeline, such as:

- Data loading
- Image preprocessing
- PyTorch DataLoader
- Multiple worker processes
- PIL/OpenCV image processing
- CPU/GPU resources
- Native libraries
- Corrupted image files
- Model or training code

Therefore, an error such as:

```text
Segmentation fault
```

does not automatically mean that the model architecture is incorrect.

---

## What Are DataLoader Workers?

PyTorch's `DataLoader` is responsible for loading and preparing training data.

The `workers` parameter controls how many **additional worker processes** are used to load and prepare the data.

For example:

```text
--workers 0
```

means:

```text
Main Python Process
       |
       +-- Load and prepare data
       |
       +-- Train model
```

There are **zero additional DataLoader worker processes**.

With:

```text
--workers 2
```

the structure is approximately:

```text
              Main Python Process
                      |
                   Train Model
                      |
              +-------+-------+
              |               |
          Worker 1         Worker 2
        Load/prepare     Load/prepare
            data             data
```

With more workers, multiple processes can load and prepare batches in parallel.

---

## Why Use Multiple Workers?

Multiple workers can improve **data-loading throughput**.

Instead of relying entirely on the main process to prepare data, additional workers can prepare batches while the main process is performing other work.

This can make training faster when the system and workload benefit from parallel data loading.

However, workers do **not** mean that the entire dataset is loaded into memory at once.

The DataLoader generally loads and prepares data in **batches as required during training**.

For example:

```text
Dataset
   |
   +--> Batch 1
   +--> Batch 2
   +--> Batch 3
   +--> ...
```

---

## Why Can Multiple Workers Cause Problems?

Using multiple workers creates additional processes and therefore increases system complexity and resource usage.

Potential issues include:

- Higher RAM usage
- Higher CPU usage
- Windows multiprocessing behavior
- PyTorch DataLoader multiprocessing issues
- Image-library compatibility problems
- Worker processes crashing
- Corrupted images causing loading failures
- Python/PyTorch environment issues

This does **not** mean that the computer is necessarily too weak.

Even a powerful computer can experience multiprocessing-related problems depending on the operating system, Python environment, PyTorch version, dataset, and training code.

---

## Why Are We Using `--workers 0`?

For the MEDIVISION project, we are currently using:

```bash
--workers 0
```

The reason is **stability and troubleshooting**.

With `workers = 0`, there are no additional DataLoader worker processes.

The main Python process handles the DataLoader operations.

This gives us a simpler training pipeline:

```text
Main Python Process
       |
       +--> Load/prepare batch
       |
       +--> Train model
       |
       +--> Load/prepare next batch
       |
       +--> Train
       |
       +--> Continue...
```

This does **not** mean that only one image is loaded at a time.

For example, if the batch size is:

```text
batch_size = 32
```

the main process can load and prepare a batch containing 32 images before the model processes that batch.

---

## MEDIVISION Training Command

For our current Windows environment, the recommended training command is:

```bash
python -m ml.training.train --csv data/labels.csv --image-root data/images --classes Normal Pneumonia Cardiomegaly Pleural_Effusion --epochs 10 --workers 0
```

The important setting is:

```text
--workers 0
```

---

## Resume Training

The same worker configuration should be used when resuming training from a checkpoint:

```bash
python -m ml.training.train --csv data/labels.csv --image-root data/images --classes Normal Pneumonia Cardiomegaly Pleural_Effusion --epochs 10 --workers 0 --resume models/best_model.pth.last
```

Here:

```text
--workers 0
```

controls DataLoader worker processes.

And:

```text
--resume models/best_model.pth.last
```

loads the previously saved training checkpoint.

These two options serve **different purposes**.

### `--workers 0`

Controls:

> How many additional DataLoader worker processes are used?

### `--resume`

Controls:

> Should training continue from a previously saved checkpoint?

---

## Important Clarification

Using:

```text
--workers 0
```

does not guarantee that every possible training crash will disappear.

It only removes **additional DataLoader worker processes** from the training pipeline.

If the training still produces a segmentation fault with:

```text
--workers 0
```

then the problem may be somewhere else, such as:

- Image loading
- Image preprocessing
- A corrupted image
- PyTorch/native library
- Memory/resource issue
- Model execution
- Another part of the training code

Therefore, `workers = 0` is primarily a **stability and troubleshooting configuration**, not proof that workers were the original cause of the crash.

---

## Summary

| Setting       | Meaning                                                                                |
| ------------- | -------------------------------------------------------------------------------------- |
| `workers = 0` | Main Python process handles data loading                                               |
| `workers = 1` | Main process + 1 additional worker                                                     |
| `workers = 2` | Main process + 2 additional workers                                                    |
| `workers = 4` | Main process + 4 additional workers                                                    |
| More workers  | Can improve data-loading performance but increases resource/multiprocessing complexity |

### Current MEDIVISION Configuration

```text
Operating System: Windows
Python: 3.11.9
PyTorch: CPU version
DataLoader Workers: 0
```

The current priority is:

```text
STABILITY
   ↓
Reliable data loading
   ↓
Reliable model training
   ↓
Checkpoint saving
   ↓
Resume training if interrupted
```

Once the training is stable, different worker counts such as `2` can be tested if faster data loading is required.

## Linux vs Windows for Machine Learning

Linux is generally more convenient and can be more efficient than Windows for machine-learning and data-training workloads, especially when using GPU acceleration and multiprocessing.

### Why Linux is commonly preferred

- Better support for many machine-learning tools and frameworks.
- Commonly used for GPU-based ML training and server environments.
- Generally fewer complications with multiprocessing.
- Widely used in research, cloud, and production ML environments.
- Works well with Python, PyTorch, CUDA, and NVIDIA GPU environments.

### Important Note

Windows can also run machine-learning projects successfully, including PyTorch and GPU-based training. Linux is **not mandatory**. It is simply often preferred because the ML ecosystem and training workflows are commonly optimized around Linux.

For the **MEDIVISION** project, Windows can be used for development and training. Using `--workers 0` can also provide a simpler and more stable DataLoader configuration when multiprocessing causes issues.
