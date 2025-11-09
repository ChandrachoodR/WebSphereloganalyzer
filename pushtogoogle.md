# Cloud Deployment & Repository Push

## 1. Build & Push Container to Artifact Registry / GCR
```bash
# Set variables once
PROJECT_ID=your-gcp-project
REGION=us-central1        # choose your region
IMAGE_NAME=websphere-log-analyser

# Build locally and push via Cloud Build
gcloud builds submit --tag gcr.io/${PROJECT_ID}/${IMAGE_NAME}
```

## 2. Deploy to Cloud Run
```bash
gcloud run deploy ${IMAGE_NAME} \
  --image gcr.io/${PROJECT_ID}/${IMAGE_NAME} \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_api_key_here,GEMINI_MODEL=gemini-2.5-flash
```

_Tip:_ Use Secret Manager instead of inline env vars in production:
```bash
gcloud run services update ${IMAGE_NAME} \
  --update-secrets=GEMINI_API_KEY=projects/${PROJECT_ID}/secrets/gemini-api-key:latest
```

## 3. Push Code to GitHub
```bash
# Add files and commit
git add .
git commit -m "Prepare Cloud Run deployment"

# Ensure remote is set (replace with your repo URL)
git remote set-url origin git@github.com:username/websphere-log-analyser.git

# Push current branch
git push origin main
```

After the push succeeds, rerun the Cloud Build / Cloud Run commands whenever you update the code.
