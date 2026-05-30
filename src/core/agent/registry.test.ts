import { describe, it, expect } from 'vitest';
import { parseAgentFile, serializeAgentMd } from './registry';

describe('registry', () => {
  describe('parseAgentFile', () => {
    it('parses valid AGENT.md with frontmatter', () => {
      const raw = `---
name: test-agent
description: A test agent
avatar: 🤖
---
You are a test agent.`;
      const result = parseAgentFile(raw, '/path/to/AGENT.md');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('test-agent');
      expect(result!.description).toBe('A test agent');
      expect(result!.avatar).toBe('🤖');
      expect(result!.systemPrompt).toBe('You are a test agent.');
      expect(result!.filePath).toBe('/path/to/AGENT.md');
    });

    it('returns null for invalid format (no frontmatter)', () => {
      expect(parseAgentFile('just plain text', '/path')).toBeNull();
    });

    it('returns null when name is missing', () => {
      const raw = `---
description: no name
---
Prompt`;
      expect(parseAgentFile(raw, '/path')).toBeNull();
    });

    it('returns null for empty name', () => {
      const raw = `---
name: ""
---
Prompt`;
      expect(parseAgentFile(raw, '/path')).toBeNull();
    });

    it('parses optional fields', () => {
      const raw = `---
name: agent
model: claude-sonnet-4-6
max-turns: 50
tools:
  - read_file
  - write_file
disallowed-tools:
  - run_command
skills:
  - coding
memory: project
background: true
intro: I am an agent
expertise:
  - coding
sample-prompts:
  - help me
category: tech
tags:
  - dev
---
System prompt here`;
      const result = parseAgentFile(raw, '/path');
      expect(result).not.toBeNull();
      expect(result!.model).toBe('claude-sonnet-4-6');
      expect(result!.maxTurns).toBe(50);
      expect(result!.tools).toEqual(['read_file', 'write_file']);
      expect(result!.disallowedTools).toEqual(['run_command']);
      expect(result!.skills).toEqual(['coding']);
      expect(result!.memory).toBe('project');
      expect(result!.background).toBe(true);
      expect(result!.intro).toBe('I am an agent');
      expect(result!.expertise).toEqual(['coding']);
      expect(result!.samplePrompts).toEqual(['help me']);
      expect(result!.category).toBe('tech');
      expect(result!.tags).toEqual(['dev']);
    });

    it('defaults optional fields', () => {
      const raw = `---
name: minimal
---
Prompt`;
      const result = parseAgentFile(raw, '/path');
      expect(result!.description).toBe('');
      expect(result!.memory).toBe('session');
      expect(result!.background).toBe(false);
    });

    it('returns null for malformed YAML', () => {
      const raw = `---
name: [invalid yaml
---
Prompt`;
      expect(parseAgentFile(raw, '/path')).toBeNull();
    });

    it('handles multiline system prompt', () => {
      const raw = `---
name: agent
---
Line 1

Line 2

Line 3`;
      const result = parseAgentFile(raw, '/path');
      expect(result!.systemPrompt).toContain('Line 1');
      expect(result!.systemPrompt).toContain('Line 3');
    });
  });

  describe('serializeAgentMd', () => {
    it('serializes basic metadata', () => {
      const md = serializeAgentMd({ name: 'test', description: 'desc' }, 'System prompt');
      expect(md).toContain('---');
      expect(md).toContain('name: test');
      expect(md).toContain('description: desc');
      expect(md).toContain('System prompt');
    });

    it('skips undefined/null/empty fields', () => {
      const md = serializeAgentMd({ name: 'test', avatar: undefined, model: '' }, 'Prompt');
      expect(md).not.toContain('avatar');
      expect(md).not.toContain('model');
    });

    it('skips empty arrays', () => {
      const md = serializeAgentMd({ name: 'test', tools: [] }, 'Prompt');
      expect(md).not.toContain('tools');
    });

    it('serializes arrays', () => {
      const md = serializeAgentMd({ name: 'test', tools: ['read_file', 'write_file'] }, 'Prompt');
      expect(md).toContain('read_file');
      expect(md).toContain('write_file');
    });

    it('serializes background flag', () => {
      const md = serializeAgentMd({ name: 'test', background: true }, 'Prompt');
      expect(md).toContain('background: true');
    });

    it('roundtrips with parseAgentFile', () => {
      const metadata = {
        name: 'roundtrip',
        description: 'Test agent',
        avatar: '🔧',
        model: 'claude-sonnet-4-6',
        maxTurns: 30,
        tools: ['read_file'],
        memory: 'session' as const,
      };
      const prompt = 'You are a roundtrip test agent.';
      const serialized = serializeAgentMd(metadata, prompt);
      const parsed = parseAgentFile(serialized, '/path');
      expect(parsed).not.toBeNull();
      expect(parsed!.name).toBe('roundtrip');
      expect(parsed!.description).toBe('Test agent');
      expect(parsed!.avatar).toBe('🔧');
      expect(parsed!.model).toBe('claude-sonnet-4-6');
      expect(parsed!.maxTurns).toBe(30);
      expect(parsed!.tools).toEqual(['read_file']);
      expect(parsed!.systemPrompt).toBe(prompt);
    });

    it('handles max-turns key format', () => {
      const md = serializeAgentMd({ name: 'test', maxTurns: 50 }, 'Prompt');
      expect(md).toContain('max-turns: 50');
    });

    it('handles disallowed-tools key format', () => {
      const md = serializeAgentMd({ name: 'test', disallowedTools: ['run_command'] }, 'Prompt');
      expect(md).toContain('disallowed-tools');
    });

    it('handles sample-prompts key format', () => {
      const md = serializeAgentMd({ name: 'test', samplePrompts: ['help me'] }, 'Prompt');
      expect(md).toContain('sample-prompts');
    });
  });
});
