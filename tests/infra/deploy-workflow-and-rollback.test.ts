import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Continuous Deployment Workflow & Rollback Runbook (ISSUE-26)', () => {
  const rootDir = process.cwd();

  it('defines .github/workflows/deploy.yml with OIDC authentication, immutable SHA tags, migrations, ECS update and CloudFront invalidation', () => {
    const deployYmlPath = path.join(rootDir, '.github/workflows/deploy.yml');
    expect(fs.existsSync(deployYmlPath)).toBe(true);
    const content = fs.readFileSync(deployYmlPath, 'utf-8');

    expect(content).toContain('id-token: write');
    expect(content).toContain('aws-actions/configure-aws-credentials@v4');
    expect(content).toContain('${{ github.sha }}');
    expect(content).toContain('npm run db:migrate');
    expect(content).toContain('aws ecs update-service');
    expect(content).toContain('aws cloudfront create-invalidation');
  });

  it('documents operational rollback procedures in docs/runbook-rollback.md', () => {
    const runbookPath = path.join(rootDir, 'docs/runbook-rollback.md');
    expect(fs.existsSync(runbookPath)).toBe(true);
    const content = fs.readFileSync(runbookPath, 'utf-8');

    expect(content).toContain('aws ecs update-service');
    expect(content).toContain('npm run db:migrate:down');
  });
});
