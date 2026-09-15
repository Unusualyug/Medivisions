# MediVision AI — Detailed Project Guide

## 1. What this project is

MediVision AI is a research-oriented chest X-ray analysis platform. It combines a mobile-first React web application, a Node.js/Express/tRPC backend, MongoDB Atlas mirroring, Cloudinary image storage, and a separate Python FastAPI service containing a DenseNet121 multi-label image-classification model.

The platform is designed to help an authenticated user upload a chest X-ray, send it for analysis, view model probability outputs and Grad-CAM explanation artifacts, save a report, and download a PDF. Doctor/reviewer users can review reports separately from the AI output. Administrators can manage users, model versions, evaluation evidence, settings, and operational records.

This is an educational/research prototype. The model output is not a diagnosis, the probability is not a certainty score, and Grad-CAM is an explanation aid rather than proof of clinical localization. Do not use the system for medical decision-making or real patient care until it has undergone appropriate clinical validation, privacy review, regulatory review, security testing, and professional oversight.

## 2. Project folders

The delivered source bundle contains two independent applications:

```text
medivision-ai-bundle/
├── detail_readme.md
├── medivision-ai-platform/    # React/Vite frontend + Node/Express/tRPC backend
└── medivision-ai-ml/          # Python/PyTorch DenseNet121 + FastAPI service
```

Important platform locations:

```text
medivision-ai-platform/client/       React pages and components
medivision-ai-platform/server/       Node backend, tRPC procedures, integrations, PDF reports
medivision-ai-platform/server/integrations/
                                      Cloudinary, MongoDB, ML-service, upload-safety adapters
medivision-ai-platform/drizzle/      relational compatibility schema and migrations
medivision-ai-platform/shared/       shared TypeScript types/constants
```

Important ML locations:

```text
medivision-ai-ml/ml/datasets/         CSV/image loading and validation
medivision-ai-ml/ml/training/         DenseNet121 training and checkpoints
medivision-ai-ml/ml/evaluation/       held-out metrics and plots
medivision-ai-ml/ml/inference/        prediction logic
medivision-ai-ml/ml/explainability/  Grad-CAM implementation
medivision-ai-ml/ml/service/app.py    FastAPI entrypoint
```

The ZIP intentionally excludes dependency folders, local Python virtual environments, large private datasets, and generated runtime artifacts. Install dependencies locally and place your own dataset/checkpoint files in the locations described below.

## 3. Architecture and request flow

```text
Browser / mobile browser
        |
        v
React + Vite frontend
        |
        v
Node.js + Express + tRPC API
   |          |             |
   |          |             +--> Clerk authentication and role verification
   |          +----------------> Cloudinary image storage
   +---------------------------> MongoDB Atlas mirror / application records
        |
        v
Python FastAPI ML service
        |
        v
DenseNet121 prediction + Grad-CAM
```

The Node backend is the security and data-orchestration boundary. The browser does not receive MongoDB credentials, Cloudinary API secrets, or the Python service's internal credentials. The Python service does not access MongoDB directly; it receives an image request from Node and returns model results. Node stores and retrieves application records.

A normal analysis flow is:

1. The user signs in through Clerk.
2. The user selects or drops a JPG, JPEG, or PNG image.
3. The frontend validates file type, size, dimensions, and basic image quality.
4. The backend validates the upload again, checks file signatures, applies rate limits, and performs baseline malware-signature screening.
5. The image is stored in Cloudinary when Cloudinary is configured.
6. A study/report record is created with `processing` status.
7. Node calls the Python service `/predict` endpoint using the stored image URL.
8. The prediction, model version, processing time, and status are saved by Node and mirrored to MongoDB when MongoDB is configured.
9. The result page shows probabilities, finding groups, technical details, and explanation panels.
10. The user can generate/download an owner-authorized PDF report. A service failure produces a failed report rather than fabricated findings.

If `ML_SERVICE_URL` is not configured, reports remain in processing rather than displaying invented predictions.

## 4. Prerequisites

Install the following before running locally:

- Node.js 22 or a compatible current LTS version.
- pnpm.
- Python 3.10 or newer for the ML service.
- Git, recommended.
- A Clerk application for authentication.
- A MongoDB Atlas database if MongoDB mirroring is required.
- A Cloudinary account if remote image storage is required.
- A trained ML checkpoint and metadata file before starting real predictions.

## 5. Configure the web platform

Open a terminal in the platform folder:

```bash
cd medivision-ai-platform
pnpm install
```

Configure secrets through your project environment/secret manager. Do not commit secrets to Git or place real credentials in the ZIP. The important server-side variables are:

```text
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
ML_SERVICE_URL=http://127.0.0.1:8001
WEB_ORIGIN=http://localhost:3000
```

The frontend also needs the Clerk publishable-key configuration used by the project. Clerk secret keys must remain server-side. If the project is run outside the managed WebDev environment, configure the existing Clerk variables expected by the authentication bootstrap and use the correct Clerk redirect/origin settings for your local URL.

Never expose `MONGODB_URI`, `CLOUDINARY_API_SECRET`, or a Clerk secret key in React code. If any credential has been exposed publicly, rotate it in the provider dashboard before production use.

## 6. Start the web application

Use Terminal 1:

```bash
cd medivision-ai-platform
pnpm dev
```

The development application normally starts on port 3000. Open the URL printed by the terminal. In the managed project, the preview is available from the project website link.

For validation:

```bash
cd medivision-ai-platform
pnpm run check
pnpm test -- --run
pnpm run build
```

For a production-style local run:

```bash
cd medivision-ai-platform
pnpm run build
pnpm start
```

The platform currently retains the existing relational/WebDev compatibility layer while Node-owned MongoDB repositories provide the MERN data boundary. A production migration should make MongoDB the tested primary persistence system rather than assuming both stores are authoritative.

## 7. Prepare the ML project

Use Terminal 2:

```bash
cd medivision-ai-ml
python -m venv .venv
```

Activate the environment:

macOS/Linux:

```bash
. .venv/bin/activate
```

Windows PowerShell:

```powershell
.venv\\Scripts\\Activate.ps1
```

Windows Git Bash:

```bash
source .venv/Scripts/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

If Windows Git Bash reports that `.venv/bin/activate` does not exist, use `source .venv/Scripts/activate` instead. The virtual environment is created differently on Windows.

## 8. Where to put X-ray images and the CSV

Inside the ML project, create these paths:

```text
medivision-ai-ml/
├── data/
│   ├── images/
│   │   ├── image_001.png
│   │   ├── image_002.jpg
│   │   └── ...
│   └── labels.csv
```

Put the actual X-ray image files inside `data/images/`. You may keep images in subfolders if the paths in the CSV include those subfolders. Images can be mixed together; the original CSV connects each image to its labels through `Image Index`.

The preferred CSV is the original NIH-style CSV and should retain all of its original metadata. The loader derives labels from `Finding Labels`, so you do not need to delete columns or create a stripped-down CSV. It uses image pixels plus safe metadata fields (`Patient Age`, `Patient Sex`, `View Position`, dimensions, and pixel spacing). `Image Index`, `Patient ID`, and `Follow-up #` remain for traceability but are excluded from prediction.

The CSV must contain:

- `Image Index` and `Finding Labels` columns.
- The original metadata columns: `Patient Age`, `Patient Sex`, `View Position`, `OriginalImage[Width`, `Height]`, `OriginalImagePixelSpacing[x`, and `y]`.
- One row per image.

Example of the original CSV format:

```csv
Image Index,Finding Labels,Follow-up #,Patient ID,Patient Age,Patient Sex,View Position,OriginalImage[Width,Height],OriginalImagePixelSpacing[x,y]
image_001.png,No Finding,0,1,57,M,PA,2682,2749,0.143,0.143
image_002.jpg,Pneumonia,0,2,66,F,AP,2500,2048,0.171,0.171
image_003.png,Cardiomegaly|Effusion,0,3,72,M,PA,2500,2048,0.168,0.168
```

Do not put the full Windows path in the CSV. The `Image Index` value must match a file below `data/images/` exactly.

The CSV is not a second copy of the images. It is the metadata and label index that tells the training code which labels and patient/image attributes belong to each image. `No Finding` becomes `Normal`, `Effusion`/`Pleural Effusion` becomes `Pleural_Effusion`, and matching labels such as `Pneumonia` and `Cardiomegaly` are derived automatically. If you download several dataset ZIP archives, extract all images into `data/images/`, then keep rows only for images you actually want to train. The filenames in `Image Index` must match the extracted filenames exactly.

## 9. Train the model

From `medivision-ai-ml`, with the virtual environment activated:

```bash
python -m ml.training.train \
  --csv data/labels.csv \
  --image-root data/images \
  --classes Normal Pneumonia Cardiomegaly Pleural_Effusion \
  --epochs 20
```

For Windows PowerShell, the same command can be written on one line:

```powershell
python -m ml.training.train --csv data/labels.csv --image-root data/images --classes Normal Pneumonia Cardiomegaly Pleural_Effusion --epochs 20
```

Replace the class names with the exact label-column names in your CSV. If your CSV has 14 findings, pass all 14 names after `--classes`.

Training creates or updates:

```text
medivision-ai-ml/models/best_model.pth       best validation checkpoint
medivision-ai-ml/models/best_model.pth.last  interrupt-safe latest checkpoint
medivision-ai-ml/models/metadata.json        class/model/preprocessing metadata
```

To resume an interrupted run:

```bash
python -m ml.training.train \
  --csv data/labels.csv \
  --image-root data/images \
  --classes Normal Pneumonia Cardiomegaly Pleural_Effusion \
  --epochs 20 \
  --resume models/best_model.pth.last
```

Training on only 100 images is useful for checking that the pipeline runs, but it is not enough to claim reliable medical performance. Do not display metrics as meaningful until evaluation is run on a separate held-out dataset.

## 10. Evaluate the trained model

Run evaluation after training:

```bash
cd medivision-ai-ml
python -m ml.evaluation.evaluate \
  --csv data/labels.csv \
  --image-root data/images \
  --classes Normal Pneumonia Cardiomegaly Pleural_Effusion
```

Evaluation writes actual evidence under `outputs/evaluation/`, including structured JSON metrics, ROC curves, confusion matrices, and metadata updates. The platform's admin metrics area is intended to show imported real evaluation evidence, not invented or placeholder scores.

Metrics include per-class and macro ROC-AUC, precision, recall/sensitivity, specificity, and F1 where computable. With a very small or imbalanced dataset, some metrics may be undefined or unstable; interpret them carefully.

## 11. Start the Python ML service

After a checkpoint and metadata file exist, use Terminal 2:

macOS/Linux:

```bash
cd medivision-ai-ml
. .venv/bin/activate
MODEL_PATH=./models/best_model.pth \
METADATA_PATH=./models/metadata.json \
uvicorn ml.service.app:app --host 0.0.0.0 --port 8001
```

Windows PowerShell:

```powershell
cd medivision-ai-ml
.venv\\Scripts\\Activate.ps1
$env:MODEL_PATH=".\\models\\best_model.pth"
$env:METADATA_PATH=".\\models\\metadata.json"
uvicorn ml.service.app:app --host 0.0.0.0 --port 8001
```

Check health before uploading:

```bash
curl http://127.0.0.1:8001/health
```

The expected service endpoints are:

- `GET /health` — confirms service/model readiness.
- `POST /predict` — accepts JSON containing `imageUrl` and optional `studyId`.
- `POST /gradcam` — accepts multipart image data, `studyId`, and `finding`.

The Node platform must use `ML_SERVICE_URL=http://127.0.0.1:8001` when both services run on the same computer.

## 12. Website features and what each feature does

### Landing page

The public landing page explains the research purpose, DenseNet121 workflow, multi-label analysis, Grad-CAM explainability, safeguards, and processing workflow. It is intentionally transparent about the prototype status and does not present fabricated clinical accuracy.

### Registration and login

Clerk handles registration, sign-in, session management, email verification, password recovery, secure authentication tokens, and the provider-managed password security flow. The application does not implement a second custom password database. After authentication, the backend synchronizes the user identity and effective role.

### Logout and automatic session protection

Logout ends the authenticated application session through the auth layer. The client also monitors inactivity and protects sensitive dashboard pages. Clerk remains responsible for the underlying session/JWT verification.

### Profile and security pages

An authenticated user can view profile/account information and access security-related account controls provided through Clerk. User identity and role are used by the backend for authorization.

### Role-based access

The supported application roles are patient, doctor/reviewer, and admin. Patients can manage their own uploads and reports. Doctors/reviewers can access review workflows. Admins can access governance and operational controls. Backend procedures enforce authorization; hiding a button in the frontend is not the security boundary.

### Dashboard

The dashboard summarizes total scans, recent analyses, processing outcomes, common finding summaries, monthly activity, average processing time, model-version information, recent reports, and quick upload actions. Loading, empty, processing, failed, and success states are represented separately so a missing result is not presented as a prediction.

### X-ray upload

The upload page supports drag-and-drop and file selection for JPG, JPEG, and PNG images. It validates file type, file size, dimensions, and basic image quality. The user can preview, remove, or replace a file before submitting. Upload progress and failure messages are shown. Backend validation repeats the important checks, applies rate limiting, screens for known malicious signatures, and stores the image securely through Cloudinary when configured.

### Processing state

After upload, the report is created with `processing` status. The interface displays that the analysis is waiting for the ML service. When the Python service returns a result, Node saves the completed findings and the UI can display them. If the service is unavailable or prediction fails, the report becomes `failed` and the UI shows an error rather than inventing values.

### Results page

The results page displays probability bars, risk grouping, positive/negative finding cards, model version, timestamp, processing information, expandable technical details, and the research disclaimer. It can show the original image, processed image, Grad-CAM heatmap, and overlay when those artifacts are available. The result is model evidence, not a confirmed diagnosis.

### Reports library

The report library stores user-scoped report history. Users can search, filter, and sort reports, open previous results, inspect processing status, and delete their own reports where enabled. Authorization prevents one user from downloading or viewing another user's report.

### PDF report generation

The backend generates the PDF rather than relying on untrusted browser-side content. The download procedure checks ownership before returning the report. The PDF contains the report identity, findings, model information, timestamps, and research disclaimer according to the generated report data.

### Secure report sharing

The application supports expiring secure share links for eligible reports. Shared access is separate from normal owner access and should be used cautiously because it grants access to report content. Expiration and token validation reduce the risk of permanent public access.

### Reviewer workspace

Doctor/reviewer users can see assigned/reviewable studies, inspect AI evidence, add notes and comments, correct research labels, compare AI output with human assessment, approve/reject/leave pending decisions, view Grad-CAM artifacts, and export review data. Human review is intentionally displayed in a separate panel from AI evidence so the interface does not imply that an AI prediction is a confirmed diagnosis.

### Reviewer audit trail

Reviewer actions are recorded as audit events. This supports accountability and helps distinguish the original AI output from later human notes, corrections, or decisions.

### Admin Control Center

Admins can manage users, assign roles, enable/disable accounts, inspect system activity and failed predictions, register and activate model versions, upload checkpoint references, view dataset/training provenance, import real evaluation runs, inspect performance evidence, compare model versions, monitor server/integration health, manage announcements, and configure supported settings. Admin access is backend-protected and cannot be obtained merely by visiting the admin URL.

### Model-performance evidence

The admin area can show ROC-AUC, precision, recall, F1, sensitivity, specificity, per-class results, confusion matrices, ROC curves, training/validation loss, dataset size, training date, epoch count, threshold configuration, model version, and dataset version when real evaluation evidence has been imported. The application is designed not to claim metrics that were never calculated.

### Theme, responsive design, and accessibility

The interface supports dark/light presentation, responsive cards and navigation, mobile-first upload/results layouts, skeleton loaders, empty states, toast notifications, keyboard-friendly controls, visible focus states, accessible labels, and restrained animations. The layout is optimized for mobile users while still supporting tablet and desktop screens.

## 13. Security implementation and limitations

Implemented controls include Helmet security headers, CORS configuration, JSON/form request-size limits, API rate limiting, input validation, strict image type and magic-byte checks, size limits, baseline malware-signature screening, secure Cloudinary server-side upload, owner-scoped report authorization, reduced sensitive error logging, audit records, environment-based secrets, and automatic inactivity handling.

Clerk provides the current password hashing, authentication session/JWT verification, email verification, recovery, and secure identity flow. The application does not maintain a separate Argon2/bcrypt password store. Clerk's access/session mechanism should be configured according to the deployment's security requirements; do not invent or expose custom tokens in frontend code.

Before production or real patient data, add managed antivirus/sandbox scanning, HTTPS termination, secret rotation, dependency and container scanning, encrypted backups, centralized monitoring/alerting, penetration testing, formal threat modeling, privacy/consent controls, retention/deletion policies, encryption-at-rest verification, and applicable healthcare/regulatory compliance review.

## 14. Common problems

### Python virtual environment activation fails

On Windows Git Bash, use `source .venv/Scripts/activate`. On Windows PowerShell, use `.venv\\Scripts\\Activate.ps1`. On macOS/Linux, use `. .venv/bin/activate`.

### The website shows processing indefinitely

Check that the Python service is running, that `/health` is successful, that `MODEL_PATH` and `METADATA_PATH` point to real files, and that the platform environment contains `ML_SERVICE_URL=http://127.0.0.1:8001`. Also check the Node server logs for a service or Cloudinary error.

### The ML service refuses predictions

A trained checkpoint and matching metadata are required. Run training first, then evaluation, then start the service with the generated files. The service intentionally refuses to fabricate results when weights or metadata are missing.

### An image cannot be found during training

Check that the CSV path is relative to `data/images`, that filename capitalization and extension match, and that the image was extracted from the dataset ZIP. Run with the same `--image-root data/images` used in the command.

### Admin access is denied

The account must have the admin role in the application's synchronized user record and must be authenticated with the matching Clerk account. The backend checks the effective role. Changing a URL or only changing an unrelated frontend value does not grant administrator access.

### Cloudinary or MongoDB does not work

Confirm the server-side environment variables, network access, provider credentials, and URI encoding. Never put the MongoDB URI or Cloudinary secret in client code. If an old credential was shared, rotate it.

## 15. Final verification checklist

```bash
# Web application
cd medivision-ai-platform
pnpm install
pnpm run check
pnpm test -- --run
pnpm run build

# ML application
cd ../medivision-ai-ml
python -m ml.training.train --help
python -m ml.evaluation.evaluate --help
```

Then verify in order:

1. Start the Python service and confirm `/health`.
2. Start the Node/React application.
3. Sign in with a test Clerk account.
4. Upload a non-sensitive test X-ray.
5. Confirm Cloudinary storage and the `processing` state.
6. Confirm completed or failed status based on the actual ML response.
7. Open the result and report library.
8. Download a PDF as the owning user.
9. Confirm a non-owner cannot access that report.
10. Test reviewer and admin access with dedicated test accounts.

## 16. License and responsible use

Review the repository's license and dependency licenses before redistribution. Keep all training data, patient information, credentials, model checkpoints, and generated reports outside public source control unless they have been explicitly cleared for distribution.

MediVision AI is a research software prototype and is not a medical device or a substitute for qualified clinical judgment.

---

**End of detailed guide.**
