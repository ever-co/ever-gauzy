import {
	allows,
	allScopesOf,
	collaborationScopesOf,
	currentCollaborationScopes,
	enabledCollaborationGroups,
	filterCollaborationTools,
	isCollaborationTool,
	parseScopes,
	requestScopes,
	runWithCollaborationScopes
} from './scopes';

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

describe('the scopes of one request', () => {
	const env = { GAUZY_MCP_TOOLS_CHAT: 'true', GAUZY_MCP_TOOLS_DOCS: 'true' };

	it("holds a token's named collaboration scopes exactly, else what its mcp.* scopes allow, else none", () => {
		expect([...requestScopes(['chat:read', 'openid', 'mcp.write'], 's1', env)]).toEqual(['chat:read']);
		expect([...requestScopes(['mcp.read'], 's1', env)].sort()).toEqual(['chat:read', 'docs:read']);
		expect([...requestScopes(['mcp.write'], 's1', env)].sort()).toEqual(['chat:read', 'chat:write', 'docs:read', 'docs:write']);
		expect([...requestScopes(['openid'], 's1', env)]).toEqual([]);
		expect([...requestScopes([], 's1', env)]).toEqual([]);
	});

	it("holds the session's (else the deployment's) scopes without a token", () => {
		expect([...requestScopes(undefined, undefined, env)].sort()).toEqual(['chat:read', 'chat:write', 'docs:read', 'docs:write']);
		expect([...requestScopes(undefined, undefined, { ...env, GAUZY_MCP_TOOLS_SCOPES: 'docs:read' })]).toEqual(['docs:read']);
		expect([...collaborationScopesOf('s1', env, () => ['inbox:read'])]).toEqual(['inbox:read']);
		expect([...collaborationScopesOf('s1', env, () => 'chat:read docs:read')]).toEqual(['chat:read', 'docs:read']);
	});

	it('lists every other tool, and the collaboration tools the scopes allow', () => {
		const listed = [{ name: 'get_tasks' }, { name: 'list_chat_messages' }, { name: 'post_chat_message' }, { name: 'get_page' }];
		expect(filterCollaborationTools(listed, new Set(['chat:read'])).map((tool) => tool.name)).toEqual(['get_tasks', 'list_chat_messages']);
		expect(filterCollaborationTools(listed, new Set()).map((tool) => tool.name)).toEqual(['get_tasks']);
		expect(isCollaborationTool('get_page')).toBe(true);
		expect(isCollaborationTool('get_tasks')).toBe(false);
		expect(isCollaborationTool('constructor')).toBe(false);
	});

	it('carries the scopes through the awaits of one call, and only that call', async () => {
		expect(currentCollaborationScopes()).toBeUndefined();
		const seen = await runWithCollaborationScopes(new Set(['docs:read']), async () => {
			await new Promise((resolve) => setTimeout(resolve, 1));
			return [...(currentCollaborationScopes() ?? [])];
		});
		expect(seen).toEqual(['docs:read']);
		expect(currentCollaborationScopes()).toBeUndefined();
	});
});
