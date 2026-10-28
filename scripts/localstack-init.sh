#!/usr/bin/env bash
set -euo pipefail

echo "Initializing LocalStack S3 and SQS resources for Lexa..."

awslocal s3 mb s3://lexa-documents || true

DLQ_URL=$(awslocal sqs create-queue \
  --queue-name lexa-ingestion-dlq \
  --query 'QueueUrl' \
  --output text)

DLQ_ARN=$(awslocal sqs get-queue-attributes \
  --queue-url "$DLQ_URL" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

awslocal sqs create-queue \
  --queue-name lexa-ingestion-queue \
  --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\",\"VisibilityTimeout\":\"60\"}"

echo "LocalStack S3 bucket (lexa-documents) and SQS queues (lexa-ingestion-queue + DLQ) ready."
