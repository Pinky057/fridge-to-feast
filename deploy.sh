#!/bin/bash
# --------------------------------------------------------------------------
# Gemini Live Agent Challenge
# Automated Deployment Script for Google Cloud Run (Infrastructure-as-Code)
# --------------------------------------------------------------------------
# Prerequisites:
# - Google Cloud SDK installed (gcloud)
# - Logged into gcloud (gcloud auth login)
# - Set your project (gcloud config set project YOUR_PROJECT_ID)

set -e

echo "🚀 Starting Deployment to Google Cloud Run..."

# Set variables
SERVICE_NAME="fridge-to-feast"
REGION="us-central1"

# Check if GEMINI_API_KEY is available in environment or .env
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

if [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ ERROR: GEMINI_API_KEY environment variable is not set."
    echo "Please set it in the .env file before deploying."
    exit 1
fi

echo "📦 Building and deploying with gcloud run deploy..."

# Deploy the Node.js app directly to Cloud Run
# Cloud Run automatically builds the container using Google Cloud Buildpacks
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=$GEMINI_API_KEY"

echo "✅ Deployment complete!"
