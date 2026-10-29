import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Terraform Secrets & Least-Privilege IAM Roles (ISSUE-21)', () => {
  const secPath = path.resolve(
    process.cwd(),
    'infra/terraform/modules/security/main.tf'
  );

  it('defines SSM SecureString parameters and separate API and Worker IAM task roles without Resource = "*"', () => {
    expect(fs.existsSync(secPath)).toBe(true);
    const content = fs.readFileSync(secPath, 'utf-8');

    expect(content).toContain('resource "aws_ssm_parameter" "anthropic_api_key"');
    expect(content).toContain('type        = "SecureString"');
    expect(content).toContain('resource "aws_iam_role" "api_task"');
    expect(content).toContain('resource "aws_iam_role" "worker_task"');
    expect(content).toContain('"s3:PutObject"');
    expect(content).toContain('"sqs:SendMessage"');
    expect(content).toContain('"s3:GetObject"');
    expect(content).toContain('"sqs:ReceiveMessage"');
    expect(content).not.toContain('Resource = "*"');
  });
});
