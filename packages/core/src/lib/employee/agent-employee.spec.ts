import { DEFAULT_AGENT_EMAIL_DOMAIN, defaultAgentEmail, isAgentEmail } from './agent-employee';

describe('agent employee email', () => {
	it.each(['agent-1@agents.invalid', 'agent-ew-42@agents.acme.invalid', 'a.b+c@x.invalid'])('accepts %s', (email) => {
		expect(isAgentEmail(email)).toBe(true);
	});

	it.each([
		'agent@example.com',
		'agent@invalid',
		'agent@agents.invalid.com',
		'agent@agents.invalid.',
		'agents.invalid',
		'',
		`${'a'.repeat(250)}@x.invalid`
	])('refuses %s', (email) => {
		expect(isAgentEmail(email)).toBe(false);
	});

	it('defaults to a unique address under the agents domain', () => {
		const first = defaultAgentEmail();
		const second = defaultAgentEmail();
		expect(first).not.toBe(second);
		expect(first.endsWith(`@${DEFAULT_AGENT_EMAIL_DOMAIN}`)).toBe(true);
		expect(isAgentEmail(first)).toBe(true);
	});
});
