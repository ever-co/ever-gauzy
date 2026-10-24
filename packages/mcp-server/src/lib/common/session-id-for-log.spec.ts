import { sessionIdForLog } from './error-utils';

/**
 * Session ids were logged whole at info level ("Session created: <id> for user …"), and a session id is a bearer
 * credential: presented as a header, a cookie or `?sessionId=`, it acts with that session's Gauzy login.
 */
describe('sessionIdForLog', () => {
	const ID = 'mcp_lx3k2a_0123456789abcdef0123456789abcdef';

	it('logs nothing of the id itself', () => {
		const logged = sessionIdForLog(ID);

		expect(logged).toMatch(/^#[0-9a-f]{12}$/);
		expect(ID).not.toContain(logged.slice(1));
	});

	it('still tells sessions apart, and the same session alike', () => {
		expect(sessionIdForLog(ID)).toBe(sessionIdForLog(ID));
		expect(sessionIdForLog(ID)).not.toBe(sessionIdForLog(`${ID.slice(0, -1)}0`));
	});

	it('says when there is none', () => {
		expect(sessionIdForLog(undefined)).toBe('none');
		expect(sessionIdForLog('')).toBe('none');
	});
});
