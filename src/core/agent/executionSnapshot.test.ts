import { describe, it, expect } from 'vitest';
import { snapshotExecutionSteps, snapshotToExecutionSteps } from './executionSnapshot';
import type { ExecutionStep } from '../../types/execution';

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    id: 'step-1',
    executionId: 'exec-1',
    type: 'tool',
    label: 'Read file',
    status: 'completed',
    toolName: 'read_file',
    toolInput: { path: '/tmp/test' },
    source: 'agent',
    detailBlocks: [],
    ...overrides,
  };
}

describe('executionSnapshot', () => {
  describe('snapshotExecutionSteps', () => {
    it('converts empty array', () => {
      expect(snapshotExecutionSteps([])).toEqual([]);
    });

    it('strips toolInput and keeps display fields', () => {
      const steps = [makeStep()];
      const snapshots = snapshotExecutionSteps(steps);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].id).toBe('step-1');
      expect(snapshots[0].label).toBe('Read file');
      expect(snapshots[0].toolName).toBe('read_file');
      // toolInput is stripped
      expect(snapshots[0]).not.toHaveProperty('toolInput');
    });

    it('maps error status to error', () => {
      const steps = [makeStep({ status: 'error' })];
      const snapshots = snapshotExecutionSteps(steps);
      expect(snapshots[0].status).toBe('error');
    });

    it('maps non-error status to completed', () => {
      const steps = [makeStep({ status: 'running' })];
      const snapshots = snapshotExecutionSteps(steps);
      expect(snapshots[0].status).toBe('completed');
    });

    it('includes duration when present', () => {
      const steps = [makeStep({ duration: 1500 })];
      const snapshots = snapshotExecutionSteps(steps);
      expect(snapshots[0].duration).toBe(1500);
    });

    it('includes agentName when present', () => {
      const steps = [makeStep({ agentName: 'research-agent' })];
      const snapshots = snapshotExecutionSteps(steps);
      expect(snapshots[0].agentName).toBe('research-agent');
    });

    it('truncates long detail block content', () => {
      const longContent = 'x'.repeat(600);
      const steps = [makeStep({
        detailBlocks: [{
          id: 'b1',
          stepId: 'step-1',
          type: 'output',
          label: 'Result',
          content: longContent,
          isTruncated: false,
          isExpanded: false,
        }],
      })];
      const snapshots = snapshotExecutionSteps(steps);
      expect(snapshots[0].detailBlocks![0].content!.length).toBeLessThan(600);
      expect(snapshots[0].detailBlocks![0].content!).toContain('...');
    });

    it('preserves short detail block content', () => {
      const steps = [makeStep({
        detailBlocks: [{
          id: 'b1',
          stepId: 'step-1',
          type: 'output',
          label: 'Result',
          content: 'short',
          isTruncated: false,
          isExpanded: false,
        }],
      })];
      const snapshots = snapshotExecutionSteps(steps);
      expect(snapshots[0].detailBlocks![0].content).toBe('short');
    });

    it('handles child steps recursively', () => {
      const steps = [makeStep({
        childSteps: [makeStep({ id: 'child-1', label: 'Child step' })],
      })];
      const snapshots = snapshotExecutionSteps(steps);
      expect(snapshots[0].childSteps).toHaveLength(1);
      expect(snapshots[0].childSteps![0].id).toBe('child-1');
    });
  });

  describe('snapshotToExecutionSteps', () => {
    it('converts empty array', () => {
      expect(snapshotToExecutionSteps([])).toEqual([]);
    });

    it('restores execution step shape with defaults', () => {
      const snapshots = [{
        id: 's1',
        type: 'tool' as const,
        label: 'Read file',
        status: 'completed' as const,
        toolName: 'read_file',
      }];
      const steps = snapshotToExecutionSteps(snapshots);
      expect(steps[0].executionId).toBe('');
      expect(steps[0].toolInput).toEqual({});
      expect(steps[0].source).toBe('agent');
    });

    it('restores detail blocks from content', () => {
      const snapshots = [{
        id: 's1',
        type: 'tool' as const,
        label: 'Test',
        status: 'completed' as const,
        detailBlocks: [{
          id: 'b1',
          title: 'Output',
          type: 'output',
          content: 'some result',
        }],
      }];
      const steps = snapshotToExecutionSteps(snapshots);
      expect(steps[0].detailBlocks).toHaveLength(1);
      expect(steps[0].detailBlocks[0].content).toBe('some result');
      expect(steps[0].detailBlocks[0].isTruncated).toBe(false);
    });

    it('marks truncated content', () => {
      const snapshots = [{
        id: 's1',
        type: 'tool' as const,
        label: 'Test',
        status: 'completed' as const,
        detailBlocks: [{
          id: 'b1',
          title: 'Output',
          type: 'output',
          content: 'some result...',
        }],
      }];
      const steps = snapshotToExecutionSteps(snapshots);
      expect(steps[0].detailBlocks[0].isTruncated).toBe(true);
    });

    it('roundtrips with snapshotExecutionSteps', () => {
      const original = [makeStep({
        duration: 500,
        agentName: 'agent-x',
        detailBlocks: [{
          id: 'b1',
          stepId: 'step-1',
          type: 'output',
          label: 'Result',
          content: 'hello world',
          isTruncated: false,
          isExpanded: false,
        }],
      })];
      const snapshots = snapshotExecutionSteps(original);
      const restored = snapshotToExecutionSteps(snapshots);
      expect(restored[0].id).toBe(original[0].id);
      expect(restored[0].label).toBe(original[0].label);
      expect(restored[0].toolName).toBe(original[0].toolName);
      expect(restored[0].duration).toBe(500);
      expect(restored[0].agentName).toBe('agent-x');
    });
  });
});
