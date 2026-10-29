import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Terraform CloudWatch Alarms & SNS (ISSUE-29)', () => {
  const obsPath = path.resolve(
    process.cwd(),
    'infra/terraform/modules/observability/main.tf'
  );

  it('defines CloudWatch alarms for 5XX errors, DLQ messages > 0 and RAG latency with email SNS alerts', () => {
    expect(fs.existsSync(obsPath)).toBe(true);
    const content = fs.readFileSync(obsPath, 'utf-8');

    expect(content).toContain('resource "aws_cloudwatch_metric_alarm" "api_5xx_errors"');
    expect(content).toContain('resource "aws_cloudwatch_metric_alarm" "dlq_messages_visible"');
    expect(content).toContain('ApproximateNumberOfMessagesVisible');
    expect(content).toContain('resource "aws_cloudwatch_metric_alarm" "rag_latency_high"');
    expect(content).toContain('resource "aws_sns_topic"');
    expect(content).toContain('resource "aws_sns_topic_subscription"');
  });
});
