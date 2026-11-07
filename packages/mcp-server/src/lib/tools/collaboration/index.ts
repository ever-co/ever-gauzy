import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { registerChatTools } from './chat';
import { registerDocsTools } from './docs';
import { registerInboxTools } from './inbox';
import { allows, allScopesOf, COLLABORATION_TOOLS, CollaborationGroup, collaborationScopesOf, enabledCollaborationGroups } from './scopes';

const logger = new Logger('CollaborationTools');

const REGISTER: Record<CollaborationGroup, (server: McpServer, access: { read: boolean; write: boolean }) => void> = {
	chat: registerChatTools,
	docs: registerDocsTools,
	inbox: registerInboxTools
};

/**
 * Registers the collaboration tool groups (chat, docs, inbox) the deployment enables.
 *
 * A server made for one session registers each group under the scopes that session holds: a group the session may not
 * read is not registered at all — a client sees no such tool, rather than a refusal that says it exists — and its
 * writes are registered only under the write scope.
 *
 * The shared server (no session: the one every transport serves) registers every enabled group, reads and writes.
 * Who reaches which tool is decided per caller: over HTTP and WebSocket by the request's scopes (its bearer token's,
 * else its session's, else the deployment's fallback), and over an SDK transport such as stdio, which lists and calls
 * the tools itself, by the deployment's fallback scopes when it connects (see {@link restrictCollaborationTools}). The
 * fallback (`GAUZY_MCP_TOOLS_SCOPES`) is for callers without a token: it no longer hides a group from a token that
 * holds it.
 */
export function registerCollaborationTools(
	server: McpServer,
	sessionId?: string,
	env: Record<string, string | undefined> = process.env,
	scopesOf: (sessionId: string | undefined) => Set<string> = (id) => collaborationScopesOf(id, env)
): CollaborationGroup[] {
	const groups = enabledCollaborationGroups(env);
	if (!groups.length) return [];
	const scopes = sessionId === undefined ? allScopesOf(groups) : scopesOf(sessionId);
	const registered: CollaborationGroup[] = [];
	for (const group of groups) {
		const access = { read: allows(scopes, group, 'read'), write: allows(scopes, group, 'write') };
		if (!access.read) continue;
		REGISTER[group](server, access);
		registered.push(group);
	}
	if (registered.length) logger.log(`Collaboration tools: ${registered.map((group) => `${group}${allows(scopes, group, 'write') ? ' (read, write)' : ' (read)'}`).join(', ')}`);
	return registered;
}

/**
 * Removes from a server the collaboration tools the scopes do not allow, so a client of that server sees no such tool
 * and a call answers "not found", as for one never registered. The shared server calls this when an SDK transport
 * (stdio) connects, with the deployment's fallback scopes: that transport lists and calls the tools itself, without the
 * per-request checks of the HTTP and WebSocket transports. Answers the names removed.
 */
export function restrictCollaborationTools(server: McpServer, scopes: ReadonlySet<string>): string[] {
	const registered = (server as unknown as { _registeredTools?: Record<string, { remove?: () => void }> })._registeredTools ?? {};
	const removed: string[] = [];
	for (const name of Object.keys(registered)) {
		const entry = COLLABORATION_TOOLS[name];
		if (!entry || allows(scopes, entry.group, entry.access)) continue;
		const tool = registered[name];
		if (typeof tool?.remove === 'function') tool.remove();
		else delete registered[name];
		removed.push(name);
	}
	if (removed.length) logger.log(`Collaboration tools not allowed by the deployment's scopes on this transport: ${removed.join(', ')}`);
	return removed;
}

export * from './scopes';
export * from './collaboration-tool';
export * from './chat';
export * from './docs';
export * from './inbox';
