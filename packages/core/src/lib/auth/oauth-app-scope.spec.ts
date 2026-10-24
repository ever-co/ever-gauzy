import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import {
	buildOAuthAppTokenGrant,
	isOAuthAppReadPermission,
	isOAuthAppTokenScopeEnforcementEnabled,
	narrowPermissionsToOAuthAppScopes,
	narrowRolesToOAuthAppScopes,
	OAUTH_APP_RESERVED_PERMISSIONS,
	oauthAppPermissionsForScopes,
	parseOAuthAppScope,
	readOAuthAppTokenGrant
} from './oauth-app-scope';

/**
 * Owner decision Q12 (2026-10-24): a third-party OAuth-app token carries only the scopes the user approved. These are
 * the mapping and parsing rules every enforcement point (JwtStrategy, the permission guards, RequestContext) relies on.
 */
describe('oauth-app-scope', () => {
	describe('the OAUTH_APP_TOKEN_SCOPE_ENFORCEMENT kill switch', () => {
		it.each([undefined, '', 'true', 'TRUE', '1', 'yes', 'on', 'anything'])('stays on for %p', (value) => {
			expect(isOAuthAppTokenScopeEnforcementEnabled(value)).toBe(true);
		});

		it.each(['false', 'FALSE', ' false ', '0', 'off', 'no'])('turns off for %p', (value) => {
			expect(isOAuthAppTokenScopeEnforcementEnabled(value)).toBe(false);
		});
	});

	describe('the scope → permission mapping', () => {
		it('maps `zap` to the read permissions only', () => {
			const allowed = oauthAppPermissionsForScopes(['zap']);

			for (const permission of [
				PermissionsEnum.ALL_ORG_VIEW,
				PermissionsEnum.ORG_TASK_VIEW,
				PermissionsEnum.DAILY_PLAN_READ,
				PermissionsEnum.VIEW_SALES_PIPELINES
			]) {
				expect(allowed.has(permission)).toBe(true);
			}
			for (const permission of [
				PermissionsEnum.ORG_TASK_EDIT,
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.TIME_TRACKER,
				PermissionsEnum.INTEGRATION_ADD
			]) {
				expect(allowed.has(permission)).toBe(false);
			}
		});

		it('maps `zap:write` to the other permissions, and no read permission', () => {
			const allowed = oauthAppPermissionsForScopes(['zap:write']);

			for (const permission of [
				PermissionsEnum.ORG_TASK_EDIT,
				PermissionsEnum.TIME_TRACKER,
				PermissionsEnum.INTEGRATION_ADD,
				PermissionsEnum.INTEGRATION_EDIT
			]) {
				expect(allowed.has(permission)).toBe(true);
			}
			expect([...allowed].some((permission) => isOAuthAppReadPermission(permission))).toBe(false);
		});

		it.each([['authentication'], ['profile'], ['email']])(
			'grants no permission for the identity scope `%s`',
			(scope) => {
				expect(oauthAppPermissionsForScopes([scope]).size).toBe(0);
			}
		);

		it.each([['read'], ['write'], ['admin'], ['zap:all'], ['constructor'], ['toString'], ['__proto__'], ['']])(
			'grants nothing for the unknown scope `%s`',
			(scope) => {
				expect(oauthAppPermissionsForScopes([scope]).size).toBe(0);
			}
		);

		it('grants nothing without a scope', () => {
			expect(oauthAppPermissionsForScopes([]).size).toBe(0);
		});

		it('never grants a reserved permission, whatever the scopes', () => {
			const allowed = oauthAppPermissionsForScopes(['zap', 'zap:write', 'authentication', 'profile', 'email']);

			for (const permission of OAUTH_APP_RESERVED_PERMISSIONS) {
				expect(allowed.has(permission)).toBe(false);
			}
			expect(allowed.has(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)).toBe(false);
			expect(allowed.has(PermissionsEnum.TENANT_API_KEY_CREATE)).toBe(false);
			expect(allowed.has(PermissionsEnum.PROFILE_EDIT)).toBe(false);
		});

		it('narrows a permission list to the allowed ones, keeping their order', () => {
			expect(
				narrowPermissionsToOAuthAppScopes(
					[PermissionsEnum.ORG_TASK_EDIT, PermissionsEnum.ORG_TASK_VIEW, PermissionsEnum.ALL_ORG_VIEW],
					['zap']
				)
			).toEqual([PermissionsEnum.ORG_TASK_VIEW, PermissionsEnum.ALL_ORG_VIEW]);
		});
	});

	/**
	 * The Zapier app requests `zap zap:write authentication` (zapier/src/authentication.ts). Every Gauzy route its
	 * triggers and actions call must stay reachable for a user whose role holds the route's permission.
	 */
	describe('the Zapier app keeps working', () => {
		const ZAPIER_SCOPES = parseOAuthAppScope('zap zap:write authentication');

		it.each([
			['GET /organization', [PermissionsEnum.ALL_ORG_VIEW]],
			['GET /organization-team', [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW]],
			['GET /organization-projects', [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW]],
			['GET /tasks', [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW]],
			['GET /timesheet/timer/status(/worked)', [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_TRACKER]],
			['POST /timesheet/timer/start|stop', [PermissionsEnum.TIME_TRACKER]],
			[
				'POST|DELETE /integration/zapier/webhooks',
				[PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT]
			]
		])('reaches every permission %s declares', (_route, declared) => {
			expect(narrowPermissionsToOAuthAppScopes(declared, ZAPIER_SCOPES)).toEqual(declared);
		});
	});

	describe('roles', () => {
		it('lets no scope act with a role', () => {
			expect(
				narrowRolesToOAuthAppScopes(
					[RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN, RolesEnum.EMPLOYEE],
					['zap', 'zap:write', 'authentication']
				)
			).toEqual([]);
		});
	});

	describe('the token claim', () => {
		it('splits and deduplicates the approved scope parameter', () => {
			expect(parseOAuthAppScope(' zap  zap:write zap ')).toEqual(['zap', 'zap:write']);
			expect(parseOAuthAppScope(undefined)).toEqual([]);
			expect(buildOAuthAppTokenGrant('zapier', 'zap authentication')).toEqual({
				clientId: 'zapier',
				scopes: ['zap', 'authentication']
			});
		});

		it('reads no grant from a token without the claim (first-party, or issued before it existed)', () => {
			expect(readOAuthAppTokenGrant({ id: 'user-1', tenantId: 'tenant-1' })).toBeNull();
			expect(readOAuthAppTokenGrant({ id: 'user-1', oauthApp: null })).toBeNull();
			expect(readOAuthAppTokenGrant(null)).toBeNull();
		});

		it('reads the grant of an OAuth-app token', () => {
			expect(
				readOAuthAppTokenGrant({ id: 'user-1', oauthApp: { clientId: 'zapier', scopes: ['zap', 'zap'] } })
			).toEqual({ clientId: 'zapier', scopes: ['zap'] });
		});

		it.each([
			['a string', 'zap'],
			['an array', ['zap']],
			['a bad scope list', { clientId: 'x', scopes: 'zap' }]
		])('fails closed on a malformed claim (%s): an OAuth-app token with no scope', (_label, claim) => {
			expect(readOAuthAppTokenGrant({ id: 'user-1', oauthApp: claim })).toEqual(
				expect.objectContaining({ scopes: [] })
			);
		});
	});
});
