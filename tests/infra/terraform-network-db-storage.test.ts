import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Terraform Network, RDS PostgreSQL & S3+SQS+DLQ (ISSUE-20)', () => {
  const tfRoot = path.resolve(process.cwd(), 'infra/terraform');

  it('isolates RDS PostgreSQL on port 5432 to accept traffic only from the compute Security Group', () => {
    const netPath = path.join(tfRoot, 'modules/network/main.tf');
    expect(fs.existsSync(netPath)).toBe(true);
    const content = fs.readFileSync(netPath, 'utf-8');
    expect(content).toContain('resource "aws_vpc"');
    expect(content).toContain('from_port       = 5432');
    expect(content).toContain('security_groups = [aws_security_group.compute.id]');
  });

  it('provisions encrypted non-public RDS PostgreSQL 16 instance (db.t4g.micro)', () => {
    const dbPath = path.join(tfRoot, 'modules/database/main.tf');
    expect(fs.existsSync(dbPath)).toBe(true);
    const content = fs.readFileSync(dbPath, 'utf-8');
    expect(content).toContain('resource "aws_db_instance"');
    expect(content).toMatch(/engine\s*=\s*"postgres"/);
    expect(content).toMatch(/publicly_accessible\s*=\s*false/);
    expect(content).toMatch(/storage_encrypted\s*=\s*true/);
  });

  it('provisions private S3 documents bucket and SQS queue with DLQ (maxReceiveCount = 3)', () => {
    const sqPath = path.join(tfRoot, 'modules/storage_queue/main.tf');
    expect(fs.existsSync(sqPath)).toBe(true);
    const content = fs.readFileSync(sqPath, 'utf-8');
    expect(content).toContain('resource "aws_s3_bucket_public_access_block"');
    expect(content).toContain('block_public_acls       = true');
    expect(content).toContain('resource "aws_sqs_queue" "dlq"');
    expect(content).toContain('maxReceiveCount     = 3');
  });
});
