# MediVision AI

npm install --registry=https://registry.npmjs.org --fetch-retries=10 --fetch-timeout=180000

MediVision AI is a research-oriented chest X-ray workspace with a React frontend, Node.js/Express/tRPC API, MongoDB Atlas and existing relational persistence, Cloudinary image storage, and a separate Python FastAPI DenseNet121 service.

## Implemented architecture

```text
React/Vite frontend
        |
        v
Node.js / Express / tRPC API
        |                 \
        v                  v
MongoDB Atlas mirror   Cloudinary image storage
        |
        v
Python FastAPI DenseNet121 service
        |
        v
Prediction + report findings
```

The Node API remains the security boundary. Cloudinary, MongoDB, and the Python service are called only from server-side modules. No database URI or Cloudinary secret is exposed to the browser.

## Current features

The application includes Clerk authentication with patient, doctor, and admin roles; X-ray upload validation and history; Cloudinary-backed image storage when configured; MongoDB Atlas study and prediction mirroring; Python ML service health and prediction adapters; report creation and result persistence; Grad-CAM/report UI surfaces; reviewer workflows; admin governance; real-evaluation metric import; and model-version management.

When `ML_SERVICE_URL` is configured, creating a report calls the Python `/predict` endpoint using the Cloudinary image URL. Successful findings are saved in the report and mirrored to MongoDB. If the service fails, the report is marked failed and the API returns a clear gateway error. Without `ML_SERVICE_URL`, reports remain in the processing state so the UI does not fabricate a prediction.

## Secure environment variables

Configure these through the project secret manager. Do not commit them to `.env` files or source control.

```text
MONGODB_URI=mongodb+srv://...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
ML_SERVICE_URL=http://127.0.0.1:8001
```

The frontend also requires the existing Clerk publishable-key configuration. Clerk secret material remains server-side.

## Run locally

Install and start the web application:

```bash
pnpm install
pnpm run dev
```

Start the Python ML service from the separate ML project in another terminal. Use the trained checkpoint and metadata paths appropriate for your machine:

```bash
cd /path/to/medivision-ai-ml
python -m venv .venv
# macOS/Linux
. .venv/bin/activate
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
MODEL_PATH=./models/best_model.pth METADATA_PATH=./models/metadata.json uvicorn ml.service.app:app --host 0.0.0.0 --port 8001
```

On Windows PowerShell, set the variables before starting Uvicorn:

```powershell
$env:MODEL_PATH=".\\models\\best_model.pth"
$env:METADATA_PATH=".\\models\\metadata.json"
uvicorn ml.service.app:app --host 0.0.0.0 --port 8001
```

The web server uses `ML_SERVICE_URL=http://127.0.0.1:8001` by default only when the variable is explicitly configured in the project environment. Verify the Python service directly with `GET /health` before uploading an X-ray.

## Validation

```bash
pnpm run check
pnpm test -- --run
pnpm run build
```

The test suite includes authentication, upload validation, reviewer authorization, admin governance, Cloudinary credential authentication, MongoDB URI validation, and the Node-to-Python architecture boundary.

## Safety

This is an educational and research prototype. Model probabilities and Grad-CAM visualizations are not diagnoses or proof of clinical localization. The system must not be used for medical decision-making without appropriate clinical validation, regulatory review, security review, and qualified professional oversight.

## Professional security controls

The Node server applies Helmet security headers, CORS allowlisting through `WEB_ORIGIN`, JSON and URL-encoded body limits, API rate limiting, reduced error detail in logs, strict image MIME/magic-byte validation, size limits, and deterministic malware-signature screening before storage. Clerk provides the current password hashing, JWT/session verification, secure authentication flow, email verification, recovery, and inactivity handling. User-scoped report authorization is enforced in the backend, and PDF reports are generated server-side through an owner-authorized procedure.

The upload scanner is a baseline safeguard, not a replacement for a production antivirus sandbox. Production deployment should add managed malware scanning, HTTPS termination, secret rotation, dependency scanning, encrypted backups, alerting, and penetration testing. If real patient data is introduced, complete a formal privacy/consent/security assessment and comply with the applicable healthcare and data-protection requirements before use.
