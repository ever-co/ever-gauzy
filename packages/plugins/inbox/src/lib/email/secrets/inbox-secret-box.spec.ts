import { InboxSecretBox, InboxSecretError } from './inbox-secret-box';

const KEY = Buffer.alloc(32, 3).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 4).toString('base64');

describe('InboxSecretBox', () => {
	it('round-trips a secret bound to its row, and never stores it in the clear', () => {
		const box = new InboxSecretBox({ ENCRYPTION_KEY: KEY });
		const sealed = box.seal('{"apiKey":"re_live_123"}', 'provider_config', 'row-1');
		expect(sealed).toMatch(/^ib1:k:/);
		expect(sealed).not.toContain('re_live_123');
		expect(box.open(sealed, 'provider_config', 'row-1')).toBe('{"apiKey":"re_live_123"}');
	});

	it('fails closed for another row, another key, or a tampered value', () => {
		const box = new InboxSecretBox({ ENCRYPTION_KEY: KEY });
		const sealed = box.seal('secret', 'provider_config', 'row-1');
		expect(() => box.open(sealed, 'provider_config', 'row-2')).toThrow(InboxSecretError);
		expect(() =>
			new InboxSecretBox({ ENCRYPTION_KEY: OTHER_KEY }).open(sealed, 'provider_config', 'row-1')
		).toThrow(InboxSecretError);
		const parts = sealed.split(':');
		parts[4] = Buffer.from('tampered').toString('base64url');
		expect(() => box.open(parts.join(':'), 'provider_config', 'row-1')).toThrow(InboxSecretError);
		expect(() => box.open('plain-text', 'provider_config', 'row-1')).toThrow(InboxSecretError);
	});

	it('uses a key derived from JWT_SECRET only when ENCRYPTION_KEY is unset, and reads it back later', () => {
		const jwtOnly = new InboxSecretBox({ JWT_SECRET: 'a-deployment-specific-jwt-secret-value' });
		const sealed = jwtOnly.seal('secret', 'provider_config', 'row-1');
		expect(sealed).toMatch(/^ib1:j:/);
		const both = new InboxSecretBox({ ENCRYPTION_KEY: KEY, JWT_SECRET: 'a-deployment-specific-jwt-secret-value' });
		expect(both.open(sealed, 'provider_config', 'row-1')).toBe('secret');
	});

	it('refuses to store anything with a malformed key or without any key', () => {
		expect(new InboxSecretBox({ ENCRYPTION_KEY: 'short' }).problem()).toBe('encryption_key_malformed');
		expect(new InboxSecretBox({}).problem()).toBe('no_secret');
		expect(() => new InboxSecretBox({}).seal('x', 'provider_config', 'row-1')).toThrow(/ENCRYPTION_KEY/);
	});
});
