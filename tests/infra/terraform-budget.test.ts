import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Terraform Budget Alarm & Remote Backend (ISSUE-19)', () => {
  const tfRoot = path.resolve(process.cwd(), 'infra/terraform');

  it('defines Terraform versions, AWS provider and S3 remote backend in versions.tf', () => {
    const versionsPath = path.join(tfRoot, 'versions.tf');
    expect(fs.existsSync(versionsPath)).toBe(true);
    const content = fs.readFileSync(versionsPath, 'utf-8');
    expect(content).toContain('required_version');
    expect(content).toContain('hashicorp/aws');
    expect(content).toContain('backend "s3"');
  });

  it('defines aws_budgets_budget with US$ 10 limit and 50% / 80% email alerts before any paid resource', () => {
    const budgetModulePath = path.join(tfRoot, 'modules/budget/main.tf');
    expect(fs.existsSync(budgetModulePath)).toBe(true);
    const content = fs.readFileSync(budgetModulePath, 'utf-8');
    expect(content).toContain('resource "aws_budgets_budget"');
    expect(content).toContain('threshold                  = 50');
    expect(content).toContain('threshold                  = 80');
    expect(content).toContain('subscriber_email_addresses');
  });
});
