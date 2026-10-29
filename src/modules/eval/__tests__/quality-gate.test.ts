import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateQualityGate,
  DEFAULT_QUALITY_THRESHOLDS
} from '../quality-gate.js';

describe('RAG Quality Gate & CI Workflow (ISSUE-25 & ISSUE-27)', () => {
  it('passes when Hit Rate@5 >= 0.75 and MRR >= 0.60', () => {
    const verdict = evaluateQualityGate(
      { hitRate: 1.0, mrr: 0.9741, refusalAccuracy: 1.0 },
      DEFAULT_QUALITY_THRESHOLDS
    );
    expect(verdict.passed).toBe(true);
    expect(verdict.failures).toHaveLength(0);
  });

  it('fails with descriptive reasons when Hit Rate@5 or MRR drops below threshold', () => {
    const verdict = evaluateQualityGate(
      { hitRate: 0.6444, mrr: 0.4244, refusalAccuracy: 0.0 },
      DEFAULT_QUALITY_THRESHOLDS
    );
    expect(verdict.passed).toBe(false);
    expect(verdict.failures.length).toBeGreaterThanOrEqual(2);
    expect(verdict.failures[0]).toContain('Hit Rate@5');
  });

  it('configures .github/workflows/ci.yml with eval:ci quality gate, terraform validation and dependabot.yml', () => {
    const ciPath = path.resolve(process.cwd(), '.github/workflows/ci.yml');
    const dependabotPath = path.resolve(process.cwd(), '.github/dependabot.yml');

    expect(fs.existsSync(ciPath)).toBe(true);
    expect(fs.existsSync(dependabotPath)).toBe(true);

    const ciContent = fs.readFileSync(ciPath, 'utf-8');
    expect(ciContent).toContain('npm run eval:ci');
    expect(ciContent).toContain('terraform fmt -check');
  });

  it('proves the Quality Gate blocks a degraded chunking PR (exit code 1 on fixed chunking 64.4% Hit Rate@5) (ISSUE-27)', () => {
    const proveScript = path.resolve(
      process.cwd(),
      'scripts/prove-quality-gate.sh'
    );
    expect(fs.existsSync(proveScript)).toBe(true);

    let failedAsExpected = false;
    let stderrOutput = '';
    try {
      execSync('npx tsx src/scripts/eval-gate.ts --degraded', {
        cwd: process.cwd(),
        stdio: 'pipe'
      });
    } catch (err) {
      failedAsExpected = true;
      stderrOutput = String(
        (err as { stderr?: Buffer }).stderr?.toString('utf-8') ?? ''
      );
    }

    expect(failedAsExpected).toBe(true);
    expect(stderrOutput).toContain('[FALHA NO QUALITY GATE]');
    expect(stderrOutput).toContain('64.4%');
  });
});
