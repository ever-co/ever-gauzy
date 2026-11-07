import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { registerChatTools } from './chat';
import { registerDocsTools } from './docs';
import { registerInboxTools } from './inbox';
import { allows, CollaborationGroup, collaborationScopesOf, enabledCollaborationGroups } from './scopes';

const logger = new Logger('CollaborationTools');

const REGISTER: Record<CollaborationGroup, (server: McpServer, access: { read: boolean; write: boolean }) => void> = {
	chat: registerChatTools,
	docs: registerDocsTools,
	inbox: registerInboxTools
};

/**
 * Registers the collaboration tool groups (chat, docs, inbox) the deployment enables, each under the scopes the session
 * holds: a group the session may not read is not registered at all — a client sees no such tool, rather than a refusal
 * that says it exists — and its writes are registered only under the write scope.
 */
export function registerCollaborationTools(
	server: McpServer,
	sessionId?: string,
	env: Record<string, string | undefined> = process.env,
	scopesOf: (sessionId: string | undefined) => Set<string> = (id) => collaborationScopesOf(id, env)
): CollaborationGroup[] {
	const groups = enabledCollaborationGroups(env);
	if (!groups.length) return [];
	const scopes = scopesOf(sessionId);
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

export * from './scopes';
export * from './collaboration-tool';
export * from './chat';
export * from './docs';
export * from './inbox';
