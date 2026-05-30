import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTodos,
  addTodo,
  updateTodo,
  removeTodo,
  setTodos,
  clearTodos,
  formatTodosForPrompt,
} from './todoManager';
import { useTodoStore } from '../../stores/todoStore';

const CONV = 'test-conv-1';

describe('todoManager', () => {
  beforeEach(() => {
    useTodoStore.setState({ lists: {} });
  });

  describe('getTodos', () => {
    it('returns empty array for unknown conversation', () => {
      expect(getTodos('unknown')).toEqual([]);
    });

    it('returns todos for existing conversation', () => {
      addTodo(CONV, 'task 1');
      const todos = getTodos(CONV);
      expect(todos).toHaveLength(1);
      expect(todos[0].content).toBe('task 1');
    });
  });

  describe('addTodo', () => {
    it('creates a todo with pending status', () => {
      const item = addTodo(CONV, 'my task');
      expect(item.content).toBe('my task');
      expect(item.status).toBe('pending');
      expect(item.id).toBeTruthy();
      expect(item.createdAt).toBeGreaterThan(0);
    });

    it('appends to existing list', () => {
      addTodo(CONV, 'task 1');
      addTodo(CONV, 'task 2');
      expect(getTodos(CONV)).toHaveLength(2);
    });
  });

  describe('updateTodo', () => {
    it('updates status by ID', () => {
      const item = addTodo(CONV, 'task');
      const updated = updateTodo(CONV, item.id, { status: 'completed' });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('completed');
    });

    it('updates content by ID', () => {
      const item = addTodo(CONV, 'old');
      const updated = updateTodo(CONV, item.id, { content: 'new' });
      expect(updated!.content).toBe('new');
    });

    it('supports 1-based index lookup', () => {
      addTodo(CONV, 'task 1');
      addTodo(CONV, 'task 2');
      const updated = updateTodo(CONV, '2', { status: 'in_progress' });
      expect(updated).not.toBeNull();
      expect(updated!.content).toBe('task 2');
      expect(updated!.status).toBe('in_progress');
    });

    it('returns null for invalid index', () => {
      addTodo(CONV, 'task');
      expect(updateTodo(CONV, '99', { status: 'completed' })).toBeNull();
    });

    it('returns null for unknown conversation', () => {
      expect(updateTodo('unknown', 'id', { status: 'completed' })).toBeNull();
    });
  });

  describe('removeTodo', () => {
    it('removes by ID', () => {
      const item = addTodo(CONV, 'task');
      expect(removeTodo(CONV, item.id)).toBe(true);
      expect(getTodos(CONV)).toHaveLength(0);
    });

    it('removes by 1-based index', () => {
      addTodo(CONV, 'task 1');
      addTodo(CONV, 'task 2');
      expect(removeTodo(CONV, '1')).toBe(true);
      expect(getTodos(CONV)).toHaveLength(1);
      expect(getTodos(CONV)[0].content).toBe('task 2');
    });

    it('returns false for unknown conversation', () => {
      expect(removeTodo('unknown', 'id')).toBe(false);
    });
  });

  describe('setTodos', () => {
    it('replaces all todos', () => {
      addTodo(CONV, 'old');
      const items = setTodos(CONV, [
        { content: 'new 1' },
        { content: 'new 2', status: 'completed' },
      ]);
      expect(items).toHaveLength(2);
      expect(getTodos(CONV)).toHaveLength(2);
      expect(getTodos(CONV)[0].content).toBe('new 1');
      expect(getTodos(CONV)[1].status).toBe('completed');
    });
  });

  describe('clearTodos', () => {
    it('removes all todos for a conversation', () => {
      addTodo(CONV, 'task');
      clearTodos(CONV);
      expect(getTodos(CONV)).toEqual([]);
    });
  });

  describe('formatTodosForPrompt', () => {
    it('returns empty string when no todos', () => {
      expect(formatTodosForPrompt(CONV)).toBe('');
    });

    it('formats todos with status indicators', () => {
      addTodo(CONV, 'task 1');
      const item2 = addTodo(CONV, 'task 2');
      updateTodo(CONV, item2.id, { status: 'completed' });
      const result = formatTodosForPrompt(CONV);
      expect(result).toContain('1/2 已完成');
      expect(result).toContain('⬜');
      expect(result).toContain('✅');
      expect(result).toContain('task 1');
      expect(result).toContain('task 2');
    });
  });
});
