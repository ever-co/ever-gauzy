import { sessionManager } from '../../session/session-manager';

/** The collaboration tool groups: each enabled per deployment, each read and written under its own scope. */
export type CollaborationGroup = 'chat' | 'docs' | 'inbox';
export type CollaborationAccess = 'read' | 'write';
export type CollaborationScope = `${CollaborationGroup}:${CollaborationAccess}`;

export const COLLABORATION_GROUPS: readonly CollaborationGroup[] = ['chat', 'docs', 'inbox'];

/** The switch of each group: exactly `true` enables it; unset, empty and anything else keep it off (the default). */
export const COLLABORATION_GROUP_SWITCHES: Readonly<Record<CollaborationGroup, string>> = {
	chat: 'GAUZY_MCP_TOOLS_CHAT',
	docs: 'GAUZY_MCP_TOOLS_DOCS',
	inbox: 'GAUZY_MCP_TOOLS_INBOX'
};

/** The scopes a session holds when neither its token nor the deployment states them: every scope of the enabled groups. */
export const COLLABORATION_SCOPES_ENV = 'GAUZY_MCP_TOOLS_SCOPES';

/** The groups the deployment enables. */
export function enabledCollaborationGroups(env: Record<string, string | undefined> = process.env): CollaborationGroup[] {
	return COLLABORATION_GROUPS.filter((group) => env[COLLABORATION_GROUP_SWITCHES[group]] === 'true');
}

/** Every scope of the groups: what a local, single-user server holds by default. */
export function allScopesOf(groups: readonly CollaborationGroup[]): Set<string> {
	return new Set(groups.flatMap((group) => [`${group}:read`, `${group}:write`]));
}

/** A comma- or space-separated scope list, trimmed; nothing for an empty one. */
export function parseScopes(value: string | undefined | null): Set<string> | null {
	const scopes = String(value ?? '')
		.split(/[\s,]+/)
		.map((scope) => scope.trim())
		.filter(Boolean);
	return scopes.length ? new Set(scopes) : null;
}

/**
 * The scopes one session holds, in this order: the scopes its bearer token carried, when the transport recorded them
 * on the session (`metadata.oauthScopes`); else the deployment's `GAUZY_MCP_TOOLS_SCOPES`; else every scope of the
 * enabled groups — a local server speaks for its one signed-in user.
 */
export function collaborationScopesOf(
	sessionId: string | undefined,
	env: Record<string, string | undefined> = process.env,
	sessionScopes: (id: string) => unknown = (id) => sessionManager.getSession(id)?.metadata?.['oauthScopes']
): Set<string> {
	if (sessionId) {
		const recorded = sessionScopes(sessionId);
		const scopes = Array.isArray(recorded) ? new Set(recorded.map(String)) : parseScopes(typeof recorded === 'string' ? recorded : null);
		if (scopes) return scopes;
	}
	return parseScopes(env[COLLABORATION_SCOPES_ENV]) ?? allScopesOf(enabledCollaborationGroups(env));
}

/** Whether the scopes allow an access to a group: a write scope allows reading too. */
export function allows(scopes: ReadonlySet<string>, group: CollaborationGroup, access: CollaborationAccess): boolean {
	if (scopes.has(`${group}:write`)) return true;
	return access === 'read' && scopes.has(`${group}:read`);
}
