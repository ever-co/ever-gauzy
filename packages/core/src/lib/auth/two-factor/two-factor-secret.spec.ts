import { twoFactorSecretProblem, twoFactorSecretProblemMessage } from './two-factor-secret';

describe('twoFactorSecretProblem', () => {
	const key = Buffer.alloc(32, 7).toString('base64');

	it('accepts a base64 32-byte ENCRYPTION_KEY', () => {
		expect(twoFactorSecretProblem({ ENCRYPTION_KEY: key })).toBeNull();
		expect(twoFactorSecretProblem({ ENCRYPTION_KEY: ` ${key} ` })).toBeNull();
	});

	it('refuses a server without ENCRYPTION_KEY, whose secrets a restart would lose', () => {
		expect(twoFactorSecretProblem({})).toBe('missing');
		expect(twoFactorSecretProblem({ ENCRYPTION_KEY: '  ' })).toBe('missing');
	});

	it('refuses a key of another length', () => {
		expect(twoFactorSecretProblem({ ENCRYPTION_KEY: Buffer.alloc(16, 7).toString('base64') })).toBe('malformed');
	});

	it('says what the operator must do', () => {
		expect(twoFactorSecretProblemMessage('missing')).toMatch(/set ENCRYPTION_KEY/);
		expect(twoFactorSecretProblemMessage('malformed')).toMatch(/not a base64-encoded 32-byte key/);
		expect(twoFactorSecretProblemMessage('default')).toMatch(/published/);
	});
});
