#!/bin/bash
# One-time GCP setup for CI/CD
# Run this script once to configure Workload Identity Federation, Artifact Registry, and Secret Manager

set -e

GCP_PROJECT_ID="greenflag-app"
GCP_PROJECT_NUMBER="480247350372"
REGION="us-central1"
GITHUB_REPO="akashwadhwani35/greenflat"
SA_NAME="github-actions"
SA_EMAIL="${SA_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

echo "=== Setting project ==="
gcloud config set project $GCP_PROJECT_ID

echo "=== Enabling required APIs ==="
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com

echo "=== Creating Artifact Registry repo ==="
gcloud artifacts repositories create greenflag \
  --repository-format=docker \
  --location=$REGION \
  --description="GreenFlag Docker images" \
  2>/dev/null || echo "Repo already exists, skipping."

echo "=== Creating service account ==="
gcloud iam service-accounts create $SA_NAME \
  --display-name="GitHub Actions CI/CD" \
  2>/dev/null || echo "Service account already exists, skipping."

echo "=== Granting roles to service account ==="
for ROLE in \
  roles/artifactregistry.writer \
  roles/run.admin \
  roles/iam.serviceAccountUser \
  roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --quiet
done

echo "=== Setting up Workload Identity Federation ==="
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  2>/dev/null || echo "Pool already exists, skipping."

gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == '${GITHUB_REPO}'" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  2>/dev/null || echo "Provider already exists, skipping."

gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_REPO}"

echo ""
echo "=== DONE! ==="
echo ""
echo "Now add these GitHub Secrets (Settings > Secrets > Actions):"
echo ""
echo "  GCP_PROJECT_ID = ${GCP_PROJECT_ID}"
echo ""
echo "  WIF_SERVICE_ACCOUNT = ${SA_EMAIL}"
echo ""
echo "  WIF_PROVIDER (run this to get the value):"
gcloud iam workload-identity-pools providers describe github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
echo ""
echo "=== Next: Store app secrets in Secret Manager ==="
echo "Run these commands, replacing values with your production credentials:"
echo ""
echo '  echo -n "postgresql://user:pass@host:5432/dbname" | gcloud secrets create DATABASE_URL --data-file=-'
echo '  echo -n "your-jwt-secret" | gcloud secrets create JWT_SECRET --data-file=-'
echo '  echo -n "sk-your-openai-key" | gcloud secrets create OPENAI_API_KEY --data-file=-'
echo '  echo -n "your-google-maps-key" | gcloud secrets create GOOGLE_MAPS_API_KEY --data-file=-'
