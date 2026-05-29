import { describe, it, expect, beforeEach } from 'vitest';
import { usePermissionStore } from './permissionStore';

describe('permissionStore', () => {
  beforeEach(() => {
    usePermissionStore.setState({
      persistedGrants: {},
      sessionGrants: {},
      pendingRequest: null,
    });
  });

  describe('grantPermission', () => {
    it('stores a persisted grant for "always" duration', () => {
      usePermissionStore.getState().grantPermission('/home/user/project', ['read', 'write'], 'always');
      const grants = usePermissionStore.getState().persistedGrants;
      const key = '/home/user/project';
      expect(grants[key]).toBeTruthy();
      expect(grants[key].capabilities).toEqual(['read', 'write']);
      expect(grants[key].duration).toBe('always');
      expect(grants[key].expiresAt).toBeNull();
    });

    it('stores a session grant for "once" duration', () => {
      usePermissionStore.getState().grantPermission('/tmp/test', ['read'], 'once');
      expect(usePermissionStore.getState().sessionGrants['/tmp/test']).toBeTruthy();
      expect(usePermissionStore.getState().persistedGrants['/tmp/test']).toBeUndefined();
    });

    it('stores a session grant for "session" duration', () => {
      usePermissionStore.getState().grantPermission('/tmp/test', ['read'], 'session');
      expect(usePermissionStore.getState().sessionGrants['/tmp/test']).toBeTruthy();
    });

    it('sets expiration for "24h" duration', () => {
      const before = Date.now();
      usePermissionStore.getState().grantPermission('/tmp/test', ['read'], '24h');
      const grant = usePermissionStore.getState().persistedGrants['/tmp/test'];
      expect(grant).toBeTruthy();
      expect(grant.expiresAt).toBeGreaterThan(before);
      expect(grant.expiresAt!).toBeLessThanOrEqual(before + 24 * 60 * 60 * 1000 + 100);
    });

    it('normalizes paths with backslashes', () => {
      usePermissionStore.getState().grantPermission('C:\\Users\\test', ['read'], 'always');
      expect(usePermissionStore.getState().persistedGrants['C:/Users/test']).toBeTruthy();
    });

    it('normalizes paths with trailing slash', () => {
      usePermissionStore.getState().grantPermission('/home/user/', ['read'], 'always');
      expect(usePermissionStore.getState().persistedGrants['/home/user']).toBeTruthy();
    });
  });

  describe('hasPermission', () => {
    it('returns true for exact path match', () => {
      usePermissionStore.getState().grantPermission('/home/user/project', ['read', 'write'], 'always');
      expect(usePermissionStore.getState().hasPermission('/home/user/project', 'read')).toBe(true);
      expect(usePermissionStore.getState().hasPermission('/home/user/project', 'write')).toBe(true);
    });

    it('returns false for missing capability', () => {
      usePermissionStore.getState().grantPermission('/home/user/project', ['read'], 'always');
      expect(usePermissionStore.getState().hasPermission('/home/user/project', 'write')).toBe(false);
    });

    it('returns true for child path', () => {
      usePermissionStore.getState().grantPermission('/home/user/project', ['read'], 'always');
      expect(usePermissionStore.getState().hasPermission('/home/user/project/src/file.ts', 'read')).toBe(true);
    });

    it('returns false for unrelated path', () => {
      usePermissionStore.getState().grantPermission('/home/user/project', ['read'], 'always');
      expect(usePermissionStore.getState().hasPermission('/home/user/other', 'read')).toBe(false);
    });

    it('checks session grants', () => {
      usePermissionStore.getState().grantPermission('/tmp/test', ['read'], 'session');
      expect(usePermissionStore.getState().hasPermission('/tmp/test', 'read')).toBe(true);
    });

    it('returns false when no grants exist', () => {
      expect(usePermissionStore.getState().hasPermission('/any/path', 'read')).toBe(false);
    });
  });

  describe('revokePermission', () => {
    it('removes persisted grant', () => {
      usePermissionStore.getState().grantPermission('/home/user/project', ['read'], 'always');
      usePermissionStore.getState().revokePermission('/home/user/project');
      expect(usePermissionStore.getState().persistedGrants['/home/user/project']).toBeUndefined();
    });

    it('removes session grant', () => {
      usePermissionStore.getState().grantPermission('/tmp/test', ['read'], 'session');
      usePermissionStore.getState().revokePermission('/tmp/test');
      expect(usePermissionStore.getState().sessionGrants['/tmp/test']).toBeUndefined();
    });
  });

  describe('clearSessionGrants', () => {
    it('clears all session grants', () => {
      usePermissionStore.getState().grantPermission('/tmp/a', ['read'], 'session');
      usePermissionStore.getState().grantPermission('/tmp/b', ['write'], 'once');
      usePermissionStore.getState().clearSessionGrants();
      expect(usePermissionStore.getState().sessionGrants).toEqual({});
    });

    it('does not affect persisted grants', () => {
      usePermissionStore.getState().grantPermission('/home/user', ['read'], 'always');
      usePermissionStore.getState().grantPermission('/tmp/a', ['read'], 'session');
      usePermissionStore.getState().clearSessionGrants();
      expect(usePermissionStore.getState().persistedGrants['/home/user']).toBeTruthy();
    });
  });

  describe('cleanupExpired', () => {
    it('removes expired grants', () => {
      const pastTime = Date.now() - 1000;
      usePermissionStore.setState({
        persistedGrants: {
          '/expired': {
            path: '/expired',
            grantedAt: pastTime - 1000,
            expiresAt: pastTime,
            capabilities: ['read'],
            duration: '24h',
          },
          '/valid': {
            path: '/valid',
            grantedAt: Date.now(),
            expiresAt: Date.now() + 86400000,
            capabilities: ['read'],
            duration: '24h',
          },
        },
      });
      usePermissionStore.getState().cleanupExpired();
      const grants = usePermissionStore.getState().persistedGrants;
      expect(grants['/expired']).toBeUndefined();
      expect(grants['/valid']).toBeTruthy();
    });

    it('keeps grants with no expiration', () => {
      usePermissionStore.getState().grantPermission('/always', ['read'], 'always');
      usePermissionStore.getState().cleanupExpired();
      expect(usePermissionStore.getState().persistedGrants['/always']).toBeTruthy();
    });
  });

  describe('resolvePending', () => {
    it('resolves pending request and clears it', () => {
      let resolved: boolean | undefined;
      usePermissionStore.setState({
        pendingRequest: {
          type: 'workspace',
          path: '/test',
          resolve: (g: boolean) => { resolved = g; },
        },
      });
      usePermissionStore.getState().resolvePending(true);
      expect(resolved).toBe(true);
      expect(usePermissionStore.getState().pendingRequest).toBeNull();
    });
  });
});
