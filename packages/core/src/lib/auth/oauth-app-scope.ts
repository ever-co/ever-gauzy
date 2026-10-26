import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';

/**
 * Third-party OAuth-app tokens carry only the scopes the user approved (owner decision Q12, 2026-10-24).
 *
 * **What was wrong.** A user approves a registered OAuth client (the Zapier app, Ever Async, any client of the
 * `oauth_clients` registry) at `/integration/ever-gauzy/oauth/authorize` for the scopes it requested, and the
 * `/token` exchange then minted an ordinary Gauzy access token: the user's full role and permissions, the requested
 * scope echoed back and never enforced. The app could do everything the user can (a confused-deputy over-grant).
 *
 * **What is right now.** The exchange writes the approved scopes into the token ({@link OAUTH_APP_TOKEN_CLAIM}).
 * When a request is authenticated by such a token, `JwtStrategy` narrows the permissions it pins onto
 * `request.user` to the role's permissions INTERSECTED with what the scopes allow
 * ({@link narrowPermissionsToOAuthAppScopes}), and records the grant there, so:
 *
 * - every `RequestContext.hasPermission(s)` / `hasAnyPermission` check and `PermissionGuard` decide from the
 *   narrowed set; `PermissionGuard` and `TenantPermissionGuard` also narrow a route's declared permissions first,
 *   so the query they fall back to cannot grant a permission outside the scopes;
 * - every role check (`RoleGuard`, `RequestContext.hasRoles`, the SUPER_ADMIN / tenant-admin exemptions, operator
 *   checks) refuses unless a scope explicitly allows the role ({@link OAUTH_APP_SCOPE_ROLES}: none does);
 * - the routes that mint first-party tokens (workspace and organization switch, the workspace list) and the consent
 *   approval itself refuse the token outright.
 *
 * First-party sessions (password, magic code, social sign-in, workspace sign-in, refresh of those, tenant API keys)
 * never carry the claim and are unaffected. A token issued before this change carries no claim and keeps working,
 * as before, until it expires; the app's next authorization-code exchange returns a scoped token (the OAuth-app flow
 * has no refresh grant: the app runs the code flow again).
 *
 * ## Scope → permission mapping
 *
 * The scopes below are the ones Gauzy's OAuth-app clients request today: the Zapier app
 * (`packages/plugins/integration-zapier/zapier/src/authentication.ts`: `zap zap:write authentication`) and Ever
 * Async's "Sign in with Ever Gauzy" (`profile email`). They are coarse, so they map to rules rather than to lists:
 *
 * | Scope | Rule | Grants (always intersected with the user's role) |
 * |-------|------|--------------------------------------------------|
 * | `authentication`, `profile`, `email` | identity | No permission. Routes that require none still answer (`GET /user/me`, `GET /auth/authenticated`, the Zapier connection test/label). |
 * | `zap` | read | Every `*_VIEW` / `*_READ` / `VIEW_*` permission ({@link isOAuthAppReadPermission}). |
 * | `zap:write` | write | Every other permission. |
 * | anything else | — | Nothing. |
 *
 * Neither rule ever grants a permission of {@link OAUTH_APP_RESERVED_PERMISSIONS}: role and permission management,
 * super-admin and tenant/global settings, tenant API keys and OAuth clients, user accounts and invitations (an app
 * that can rewrite a user's address or password owns the account), organization switching, the inbox, the sent-mail
 * history, the SMTP settings and the email templates (sign-in codes and password-reset links travel there),
 * account/data deletion, import/export and cloud migration. Those stay with the user's own session.
 *
 * A token without the `write` rule (`zap:write`) never runs a write — a GraphQL mutation, or an HTTP method other than
 * GET/HEAD/OPTIONS — whatever the route declares: several write routes also accept a read permission
 * ({@link oauthAppScopesAllowWrites}, `shared/guards/mutating-operation.ts`). And some actions stay with the user's own
 * session whatever the scopes, because a permission a write scope reaches also opens them: creating accounts, sending
 * invitations, deleting users, approving apps and minting first-party tokens (`oauth-app-first-party.ts`).
 */

/** The environment variable that turns the enforcement off (`false`); on by default. */
export const OAUTH_APP_TOKEN_SCOPE_ENFORCEMENT_ENV = 'OAUTH_APP_TOKEN_SCOPE_ENFORCEMENT';

/**
 * Whether OAuth-app tokens are held to their approved scopes.
 *
 * The operator kill switch: `OAUTH_APP_TOKEN_SCOPE_ENFORCEMENT=false` (or `0` / `off` / `no`) restores the previous
 * behaviour, where an OAuth-app token acts with the user's full role. Anything else, an unset or empty value
 * included, keeps the enforcement on. Tokens still carry their scopes while it is off, so turning it back on applies
 * to them at once.
 *
 * @param value The setting's raw value (the environment variable by default).
 * @returns False only when the setting turns the enforcement off.
 */
export function isOAuthAppTokenScopeEnforcementEnabled(
	value: string | undefined = process.env[OAUTH_APP_TOKEN_SCOPE_ENFORCEMENT_ENV]
): boolean {
	if (value === undefined || value === null) {
		return true;
	}
	return !['false', '0', 'off', 'no'].includes(String(value).trim().toLowerCase());
}

/** The access-token claim that marks a token minted by the OAuth-app code exchange and carries its grant. */
export const OAUTH_APP_TOKEN_CLAIM = 'oauthApp';

/** What the user approved for a third-party OAuth app, as the token carries it. */
export interface IOAuthAppTokenGrant {
	/** The public `clientId` of the OAuth client the user approved. */
	clientId: string;
	/** The approved scopes, deduplicated. */
	scopes: string[];
}

/** How a scope maps onto Gauzy permissions. */
export enum OAuthAppScopeRule {
	/** Identity only: no permission. */
	IDENTITY = 'identity',
	/** The read permissions ({@link isOAuthAppReadPermission}). */
	READ = 'read',
	/** Every other permission. */
	WRITE = 'write'
}

/**
 * The scopes Gauzy understands and their rule. A Map, never a plain object: a scope named `constructor` or
 * `toString` must not resolve to something inherited.
 */
export const OAUTH_APP_SCOPE_RULES: ReadonlyMap<string, OAuthAppScopeRule> = new Map<string, OAuthAppScopeRule>([
	['authentication', OAuthAppScopeRule.IDENTITY],
	['profile', OAuthAppScopeRule.IDENTITY],
	['email', OAuthAppScopeRule.IDENTITY],
	['zap', OAuthAppScopeRule.READ],
	['zap:write', OAuthAppScopeRule.WRITE]
]);

/**
 * The roles a scope lets an OAuth-app token act with in a role check. Empty: no scope reaches a role-gated route
 * (`@Roles(...)`, SUPER_ADMIN-only or operator routes) or a tenant-admin exemption. A scope that should is added here,
 * explicitly.
 */
export const OAUTH_APP_SCOPE_ROLES: ReadonlyMap<string, readonly RolesEnum[]> = new Map<string, readonly RolesEnum[]>();

/** The permissions no scope grants: they stay with the user's own (first-party) session. */
export const OAUTH_APP_RESERVED_PERMISSIONS: ReadonlySet<PermissionsEnum> = new Set<PermissionsEnum>([
	// Role and permission management, super admin, tenant and global settings.
	PermissionsEnum.CHANGE_ROLES_PERMISSIONS,
	PermissionsEnum.SUPER_ADMIN_EDIT,
	PermissionsEnum.TENANT_ADD_EXISTING_USER,
	PermissionsEnum.TENANT_SETTING,
	PermissionsEnum.GLOBAL_SETTING,
	// Credentials: tenant API keys and OAuth clients.
	PermissionsEnum.TENANT_API_KEY_CREATE,
	PermissionsEnum.TENANT_API_KEY_VIEW,
	PermissionsEnum.TENANT_API_KEY_DELETE,
	PermissionsEnum.OAUTH_CLIENT_VIEW,
	PermissionsEnum.OAUTH_CLIENT_EDIT,
	// User accounts (address, password, role) and invitations.
	PermissionsEnum.ORG_USERS_EDIT,
	PermissionsEnum.PROFILE_EDIT,
	PermissionsEnum.ORG_INVITE_EDIT,
	// Organization switching mints a first-party token pair; the app stays in the organization it was approved in.
	PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
	// Mail the user receives or Gauzy sent them: sign-in codes and password-reset links travel there.
	PermissionsEnum.INBOX_VIEW,
	PermissionsEnum.INBOX_MAILBOX_MANAGE,
	PermissionsEnum.INBOX_MAILBOX_READ_ALL,
	PermissionsEnum.VIEW_ALL_EMAILS,
	// The outgoing mail itself: whoever sets the SMTP server, or rewrites the templates (the template writes declare
	// VIEW_ALL_EMAIL_TEMPLATES), receives or reshapes the messages that carry sign-in codes and reset links.
	PermissionsEnum.CUSTOM_SMTP_VIEW,
	PermissionsEnum.CUSTOM_SMTP_EDIT,
	PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES,
	// Account and data deletion, bulk import/export, cloud migration.
	PermissionsEnum.ACCESS_DELETE_ACCOUNT,
	PermissionsEnum.ACCESS_DELETE_ALL_DATA,
	PermissionsEnum.IMPORT_ADD,
	PermissionsEnum.EXPORT_ADD,
	PermissionsEnum.MIGRATE_GAUZY_CLOUD
]);

/**
 * Whether a permission is a read permission for the `read` rule: its name ends in `_VIEW` or `_READ`, or starts with
 * `VIEW_` (`VIEW_ALL_EMAILS`, `VIEW_SALES_PIPELINES`...).
 *
 * @param permission The permission.
 * @returns True for a read permission.
 */
export function isOAuthAppReadPermission(permission: string): boolean {
	return /_(VIEW|READ)$/.test(permission) || permission.startsWith('VIEW_');
}

/** Every permission a scope may grant: all of them but the reserved ones. */
const GRANTABLE_PERMISSIONS = (Object.values(PermissionsEnum) as PermissionsEnum[]).filter(
	(permission) => !OAUTH_APP_RESERVED_PERMISSIONS.has(permission)
);

const READ_PERMISSIONS: ReadonlySet<PermissionsEnum> = new Set(
	GRANTABLE_PERMISSIONS.filter((permission) => isOAuthAppReadPermission(permission))
);

const WRITE_PERMISSIONS: ReadonlySet<PermissionsEnum> = new Set(
	GRANTABLE_PERMISSIONS.filter((permission) => !isOAuthAppReadPermission(permission))
);

const READ_AND_WRITE_PERMISSIONS: ReadonlySet<PermissionsEnum> = new Set([...READ_PERMISSIONS, ...WRITE_PERMISSIONS]);

const NO_PERMISSIONS: ReadonlySet<PermissionsEnum> = new Set<PermissionsEnum>();

/**
 * The permissions a set of approved scopes allows (before the intersection with the user's role).
 *
 * @param scopes The approved scopes.
 * @returns The allowed permissions. An unknown scope adds nothing.
 */
export function oauthAppPermissionsForScopes(scopes: readonly string[]): ReadonlySet<PermissionsEnum> {
	const rules = new Set((scopes ?? []).map((scope) => OAUTH_APP_SCOPE_RULES.get(scope)));
	const read = rules.has(OAuthAppScopeRule.READ);
	const write = rules.has(OAuthAppScopeRule.WRITE);

	if (read && write) {
		return READ_AND_WRITE_PERMISSIONS;
	}
	if (read) {
		return READ_PERMISSIONS;
	}
	if (write) {
		return WRITE_PERMISSIONS;
	}
	return NO_PERMISSIONS;
}

/**
 * Narrows permissions (a role's, or the ones a route declares) to what a set of approved scopes allows.
 *
 * @param permissions The permissions.
 * @param scopes The approved scopes.
 * @returns The permissions the scopes allow, in their order.
 */
export function narrowPermissionsToOAuthAppScopes(
	permissions: readonly PermissionsEnum[],
	scopes: readonly string[]
): PermissionsEnum[] {
	const allowed = oauthAppPermissionsForScopes(scopes);
	return (permissions ?? []).filter((permission) => allowed.has(permission));
}

/**
 * Narrows the roles a role check accepts to the ones a set of approved scopes lets an OAuth-app token act with
 * ({@link OAUTH_APP_SCOPE_ROLES}; none today).
 *
 * @param roles The roles the check accepts.
 * @param scopes The approved scopes.
 * @returns The roles the token may be accepted with.
 */
export function narrowRolesToOAuthAppScopes(roles: readonly RolesEnum[], scopes: readonly string[]): RolesEnum[] {
	const allowed = new Set<RolesEnum>();
	for (const scope of scopes ?? []) {
		for (const role of OAUTH_APP_SCOPE_ROLES.get(scope) ?? []) {
			allowed.add(role);
		}
	}
	return (roles ?? []).filter((role) => allowed.has(role));
}

/**
 * Whether a set of approved scopes includes the `write` rule. A token without it never runs a write (a GraphQL
 * mutation, an HTTP method other than GET/HEAD/OPTIONS), whatever permissions the route declares.
 *
 * @param scopes The approved scopes.
 * @returns True when one of the scopes maps to the `write` rule.
 */
export function oauthAppScopesAllowWrites(scopes: readonly string[]): boolean {
	return (scopes ?? []).some((scope) => OAUTH_APP_SCOPE_RULES.get(scope) === OAuthAppScopeRule.WRITE);
}

/**
 * The approved scopes recorded on a request user (`request.user.oauthApp`, set by `JwtStrategy`).
 *
 * @param user The request user.
 * @returns The approved scopes (possibly none), or `null` when the user is not authenticated by an OAuth-app token.
 */
export function oauthAppScopesOf(user: { oauthApp?: IOAuthAppTokenGrant | null } | null | undefined): string[] | null {
	const grant = user?.oauthApp;
	if (!grant) {
		return null;
	}
	return Array.isArray(grant.scopes) ? grant.scopes : [];
}

/**
 * Splits an OAuth `scope` parameter (space-delimited, RFC 6749 §3.3) into its scopes.
 *
 * @param scope The parameter.
 * @returns The scopes, deduplicated; none for anything but a string.
 */
export function parseOAuthAppScope(scope: unknown): string[] {
	if (typeof scope !== 'string') {
		return [];
	}
	return [...new Set(scope.split(/\s+/).filter(Boolean))];
}

/**
 * The grant the OAuth-app code exchange writes into the token.
 *
 * @param clientId The public `clientId` of the approved client.
 * @param scope The approved `scope` parameter.
 * @returns The grant.
 */
export function buildOAuthAppTokenGrant(clientId: string, scope: unknown): IOAuthAppTokenGrant {
	return { clientId: String(clientId ?? ''), scopes: parseOAuthAppScope(scope) };
}

/**
 * Reads the OAuth-app grant of a verified access-token payload.
 *
 * @param payload The payload.
 * @returns The grant; `null` when the token is not an OAuth-app token (no claim: a first-party token, or one issued
 * before the claim existed). A claim that is present but malformed is still an OAuth-app token, granted no scope:
 * it fails closed.
 */
export function readOAuthAppTokenGrant(payload: unknown): IOAuthAppTokenGrant | null {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return null;
	}

	const claim = (payload as Record<string, unknown>)[OAUTH_APP_TOKEN_CLAIM];
	if (claim === undefined || claim === null) {
		return null;
	}

	const record = typeof claim === 'object' && !Array.isArray(claim) ? (claim as Record<string, unknown>) : {};
	const clientId = typeof record['clientId'] === 'string' ? record['clientId'] : '';
	const listed: unknown[] = Array.isArray(record['scopes']) ? record['scopes'] : [];
	const scopes = [
		...new Set(listed.filter((scope): scope is string => typeof scope === 'string' && scope.length > 0))
	];

	return { clientId, scopes };
}
