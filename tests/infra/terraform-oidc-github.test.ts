import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Terraform GitHub Actions OIDC Provider & Deploy IAM Role (ISSUE-24)', () => {
  const oidcPath = path.resolve(
    process.cwd(),
    'infra/terraform/modules/oidc_github/main.tf'
  );

  it('provisions GitHub OIDC provider and restricts deploy role trust policy to refs/heads/main', () => {
    expect(fs.existsSync(oidcPath)).toBe(true);
    const content = fs.readFileSync(oidcPath, 'utf-8');

    expect(content).toContain('resource "aws_iam_openid_connect_provider" "github"');
    expect(content).toContain('https://token.actions.githubusercontent.com');
    expect(content).toContain('token.actions.githubusercontent.com:sub');
    expect(content).toContain('repo:${var.github_repository}:ref:refs/heads/main');
  });
});
