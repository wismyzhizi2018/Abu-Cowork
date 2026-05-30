import { describe, it, expect } from 'vitest';
import { TOOL_NAMES } from './toolNames';

describe('TOOL_NAMES', () => {
  it('defines all core file/system tools', () => {
    expect(TOOL_NAMES.GET_SYSTEM_INFO).toBe('get_system_info');
    expect(TOOL_NAMES.READ_FILE).toBe('read_file');
    expect(TOOL_NAMES.WRITE_FILE).toBe('write_file');
    expect(TOOL_NAMES.EDIT_FILE).toBe('edit_file');
    expect(TOOL_NAMES.LIST_DIRECTORY).toBe('list_directory');
    expect(TOOL_NAMES.SEARCH_FILES).toBe('search_files');
    expect(TOOL_NAMES.FIND_FILES).toBe('find_files');
    expect(TOOL_NAMES.RUN_COMMAND).toBe('run_command');
  });

  it('defines web/network tools', () => {
    expect(TOOL_NAMES.WEB_SEARCH).toBe('web_search');
    expect(TOOL_NAMES.HTTP_FETCH).toBe('http_fetch');
  });

  it('defines agent/skill tools', () => {
    expect(TOOL_NAMES.USE_SKILL).toBe('use_skill');
    expect(TOOL_NAMES.DELEGATE_TO_AGENT).toBe('delegate_to_agent');
  });

  it('defines memory tools', () => {
    expect(TOOL_NAMES.UPDATE_MEMORY).toBe('update_memory');
    expect(TOOL_NAMES.TODO_WRITE).toBe('todo_write');
    expect(TOOL_NAMES.RECALL).toBe('recall');
  });

  it('defines automation tools', () => {
    expect(TOOL_NAMES.MANAGE_SCHEDULED_TASK).toBe('manage_scheduled_task');
    expect(TOOL_NAMES.MANAGE_TRIGGER).toBe('manage_trigger');
  });

  it('all values are strings', () => {
    for (const [, value] of Object.entries(TOOL_NAMES)) {
      expect(typeof value).toBe('string');
    }
  });

  it('all values are snake_case', () => {
    for (const [key, value] of Object.entries(TOOL_NAMES)) {
      expect(value).toMatch(/^[a-z][a-z0-9_]*$/, `${key}: ${value}`);
    }
  });
});
