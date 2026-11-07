import { allows, allScopesOf, collaborationScopesOf, enabledCollaborationGroups, parseScopes } from './scopes';

describe('the collaboration tool groups and their scopes', () => {
	it('enables a group on exactly true, and nothing by default', () => {
		expect(enabledCollaborationGroups({})).toEqual([]);
		expect(enabledCollaborationGroups({ GAUZY_MCP_TOOLS_CHAT: 'true', GAUZY_MCP_TOOLS_INBOX: 'TRUE', GAUZY_MCP_TOOLS_DOCS: '1' })).toEqual(['chat']);
		expect(enabledCollaborationGroups({ GAUZY_MCP_TOOLS_CHAT: 'true', GAUZY_MCP_TOOLS_DOCS: 'true', GAUZY_MCP_TOOLS_INBOX: 'true' })).toEqual(['chat', 'docs', 'inbox']);
	});

	it("reads a session's token scopes first, the deployment's list next, and every scope of the enabled groups last", () => {
		const env = { GAUZY_MCP_TOOLS_CHAT: 'true', GAUZY_MCP_TOOLS_DOCS: 'true' };
		expect(collaborationScopesOf('s1', env, () => ['chat:read', 'mcp.read'])).toEqual(new Set(['chat:read', 'mcp.read']));
		expect(collaborationScopesOf('s1', env, () => 'docs:write chat:read')).toEqual(new Set(['docs:write', 'chat:read']));
		expect(collaborationScopesOf('s1', { ...env, GAUZY_MCP_TOOLS_SCOPES: 'inbox:read, docs:read' }, () => undefined)).toEqual(new Set(['inbox:read', 'docs:read']));
		expect(collaborationScopesOf(undefined, env, () => ['never'])).toEqual(allScopesOf(['chat', 'docs']));
		expect(parseScopes('  ')).toBeNull();
	});

	it('lets a write scope read, and a read scope read only', () => {
		const scopes = new Set(['chat:write', 'docs:read']);
		expect(allows(scopes, 'chat', 'read')).toBe(true);
		expect(allows(scopes, 'chat', 'write')).toBe(true);
		expect(allows(scopes, 'docs', 'read')).toBe(true);
		expect(allows(scopes, 'docs', 'write')).toBe(false);
		expect(allows(scopes, 'inbox', 'read')).toBe(false);
	});
});
