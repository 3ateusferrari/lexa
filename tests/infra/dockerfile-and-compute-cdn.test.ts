import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Multi-Stage Dockerfile & Terraform Compute (ECS Fargate) + CDN (CloudFront + S3) (ISSUE-22)', () => {
  const rootDir = process.cwd();
  const tfRoot = path.join(rootDir, 'infra/terraform');

  it('defines a multi-stage Dockerfile running as non-root USER node with HEALTHCHECK', () => {
    const dockerfilePath = path.join(rootDir, 'Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);
    const content = fs.readFileSync(dockerfilePath, 'utf-8');
    expect(content).toContain('FROM node:20-alpine AS builder');
    expect(content).toContain('FROM node:20-alpine AS runner');
    expect(content).toContain('USER node');
    expect(content).toContain('HEALTHCHECK');
  });

  it('provisions ECR with scan_on_push and ECS Fargate services for API and Worker', () => {
    const computePath = path.join(tfRoot, 'modules/compute/main.tf');
    expect(fs.existsSync(computePath)).toBe(true);
    const content = fs.readFileSync(computePath, 'utf-8');
    expect(content).toContain('resource "aws_ecr_repository"');
    expect(content).toContain('scan_on_push = true');
    expect(content).toContain('resource "aws_ecs_task_definition" "api"');
    expect(content).toContain('resource "aws_ecs_task_definition" "worker"');
    expect(content).toContain('requires_compatibilities = ["FARGATE"]');
  });

  it('provisions CloudFront distribution with Origin Access Control (OAC) and redirect-to-https', () => {
    const cdnPath = path.join(tfRoot, 'modules/cdn/main.tf');
    expect(fs.existsSync(cdnPath)).toBe(true);
    const content = fs.readFileSync(cdnPath, 'utf-8');
    expect(content).toContain('resource "aws_cloudfront_origin_access_control"');
    expect(content).toContain('resource "aws_cloudfront_distribution"');
    expect(content).toContain('viewer_protocol_policy = "redirect-to-https"');
  });
});
