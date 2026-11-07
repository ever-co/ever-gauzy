import { AsyncLocalStorage } from 'node:async_hooks';
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

/** Every collaboration tool, the group it belongs to, and whether it reads or writes. */
export const COLLABORATION_TOOLS: Readonly<Record<string, { group: CollaborationGroup; access: CollaborationAccess }>> = {
	list_chat_conversations: { group: 'chat', access: 'read' },
	list_chat_messages: { group: 'chat', access: 'read' },
	get_chat_thread: { group: 'chat', access: 'read' },
	search_chat_messages: { group: 'chat', access: 'read' },
	post_chat_message: { group: 'chat', access: 'write' },
	mark_chat_conversation_read: { group: 'chat', access: 'write' },
	list_pages: { group: 'docs', access: 'read' },
	get_page: { group: 'docs', access: 'read' },
	search_pages: { group: 'docs', access: 'read' },
	create_page: { group: 'docs', access: 'write' },
	update_page_markdown: { group: 'docs', access: 'write' },
	list_inbox_items: { group: 'inbox', access: 'read' },
	get_inbox_counts: { group: 'inbox', access: 'read' },
	set_inbox_item_state: { group: 'inbox', access: 'write' }
};

/** Whether a tool is one of the collaboration tools (their arguments and answers are people's text: never logged). */
export function isCollaborationTool(name: unknown): boolean {
	return typeof name === 'string' && Object.prototype.hasOwnProperty.call(COLLABORATION_TOOLS, name);
}

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
 * The scopes of a caller without a bearer token (stdio, a loopback caller, a server with authorization off), in this
 * order: its session's `metadata.oauthScopes` when something recorded them there (no transport does: a caller with a
 * token is served under the token's own scopes, see {@link requestScopes}); else the deployment's
 * `GAUZY_MCP_TOOLS_SCOPES`; else every scope of the enabled groups — a local server speaks for its one signed-in user.
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

/**
 * The collaboration scopes a validated bearer token holds. A token that names collaboration scopes (`chat:read`, …)
 * holds exactly those — the fine-grained grant. A token with the platform's general scopes only holds the matching
 * access to every enabled group: `mcp.read` reads, `mcp.write` (or `mcp.admin`) writes. A token with neither holds none.
 */
export function tokenCollaborationScopes(tokenScopes: readonly unknown[], env: Record<string, string | undefined> = process.env): Set<string> {
	const scopes = tokenScopes.map(String);
	const named = scopes.filter((scope) => /^(chat|docs|inbox):(read|write)$/.test(scope));
	if (named.length) return new Set(named);
	const granted = new Set<string>();
	const groups = enabledCollaborationGroups(env);
	const writes = scopes.includes('mcp.write') || scopes.includes('mcp.admin');
	const reads = writes || scopes.includes('mcp.read');
	for (const group of groups) {
		if (reads) granted.add(`${group}:read`);
		if (writes) granted.add(`${group}:write`);
	}
	return granted;
}

/**
 * The scopes one HTTP or WebSocket request holds: its validated bearer token's (see {@link tokenCollaborationScopes}),
 * else the session's (see {@link collaborationScopesOf}).
 */
export function requestScopes(tokenScopes: unknown, sessionId?: string, env: Record<string, string | undefined> = process.env): Set<string> {
	if (Array.isArray(tokenScopes)) return tokenCollaborationScopes(tokenScopes, env);
	return collaborationScopesOf(sessionId, env);
}

/** Whether the scopes allow an access to a group: a write scope allows reading too. */
export function allows(scopes: ReadonlySet<string>, group: CollaborationGroup, access: CollaborationAccess): boolean {
	if (scopes.has(`${group}:write`)) return true;
	return access === 'read' && scopes.has(`${group}:read`);
}

/** The tools a caller may see: every other tool, and the collaboration tools its scopes allow. */
export function filterCollaborationTools<T extends { name: string }>(tools: readonly T[], scopes: ReadonlySet<string>): T[] {
	return tools.filter((tool) => {
		const entry = COLLABORATION_TOOLS[tool.name];
		return !entry || allows(scopes, entry.group, entry.access);
	});
}

const scopeContext = new AsyncLocalStorage<{ scopes: ReadonlySet<string> }>();

/** Runs one tool call under the scopes of the request that made it (the transports call this). */
export function runWithCollaborationScopes<T>(scopes: ReadonlySet<string> | undefined, fn: () => T): T {
	return scopes ? scopeContext.run({ scopes }, fn) : fn();
}

/** The scopes of the request being served, when a transport stated them. */
export function currentCollaborationScopes(): ReadonlySet<string> | undefined {
	return scopeContext.getStore()?.scopes;
}
