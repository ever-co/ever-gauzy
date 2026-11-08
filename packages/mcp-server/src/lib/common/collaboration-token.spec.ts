import { admitsCollaborationOnly } from './collaboration-token';

describe('admitsCollaborationOnly', () => {
	const env = { GAUZY_MCP_TOOLS_CHAT: 'true' };

	it('admits a token naming a collaboration scope of an enabled group', () => {
		expect(admitsCollaborationOnly(['chat:read'], env)).toBe(true);
		expect(admitsCollaborationOnly(['openid', 'chat:write'], env)).toBe(true);
	});

	it('admits nothing for a disabled group, an unknown scope or none', () => {
		expect(admitsCollaborationOnly(['docs:read'], env)).toBe(false);
		expect(admitsCollaborationOnly(['chat:admin', 'openid'], env)).toBe(false);
		expect(admitsCollaborationOnly([], env)).toBe(false);
		expect(admitsCollaborationOnly(undefined, env)).toBe(false);
	});
});
