import { IEmailProviderConfigSchema } from '@gauzy/contracts';
import { ProviderConfigError, secretFields, splitProviderConfig } from './provider-config';

const schema: IEmailProviderConfigSchema = {
	type: 'object',
	properties: {
		apiKey: { type: 'string', writeOnly: true },
		basicAuth: { type: 'string', generated: true },
		domain: { type: 'string', format: 'hostname' },
		endpoint: { type: 'string', format: 'uri' },
		publicKey: { type: 'string', format: 'textarea', writeOnly: false },
		retries: { type: 'integer', minimum: 0, maximum: 5, default: 2 },
		sandbox: { type: 'boolean' }
	},
	required: ['apiKey']
};

describe('splitProviderConfig', () => {
	it('splits the secrets from the public fields, fills defaults and generates the generated secrets', () => {
		const split = splitProviderConfig(schema, { apiKey: ' key ', domain: 'mail.acme.test', sandbox: true });
		expect(split.config).toEqual({ domain: 'mail.acme.test', sandbox: true, retries: 2 });
		expect(split.secrets['apiKey']).toBe('key');
		expect(split.secrets['basicAuth']).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(split.generated).toEqual({ basicAuth: split.secrets['basicAuth'] });
		expect(secretFields(schema)).toEqual(['apiKey', 'basicAuth']);
	});

	it('keeps stored secrets that an update leaves out or sends empty; null clears them', () => {
		const previous = { config: { domain: 'a.test', retries: 1 }, secrets: { apiKey: 'old', basicAuth: 'cred' } };
		const kept = splitProviderConfig(schema, { apiKey: '', retries: 3 }, previous);
		expect(kept.secrets).toEqual({ apiKey: 'old', basicAuth: 'cred' });
		expect(kept.config).toEqual({ domain: 'a.test', retries: 3 });
		expect(kept.generated).toEqual({});

		const cleared = splitProviderConfig(schema, { domain: null }, previous);
		expect(cleared.config).toEqual({ retries: 1 });

		expect(() => splitProviderConfig(schema, { apiKey: null }, previous)).toThrow(ProviderConfigError);
	});

	it('refuses unknown fields and values outside the form', () => {
		expect(() => splitProviderConfig(schema, { apiKey: 'k', smtp: 'x' })).toThrow(/no setting named smtp/);
		expect(() => splitProviderConfig(schema, { apiKey: 'k', endpoint: 'http://plain.test' })).toThrow(/https/);
		expect(() => splitProviderConfig(schema, { apiKey: 'k', domain: 'not a host' })).toThrow(/host name/);
		expect(() => splitProviderConfig(schema, { apiKey: 'k', retries: 9 })).toThrow(/at most 5/);
		expect(() => splitProviderConfig(schema, { apiKey: 'k', retries: 1.5 })).toThrow(/whole number/);
		expect(() => splitProviderConfig(schema, { apiKey: 'k', sandbox: 'yes' })).toThrow(/true or false/);
		expect(() => splitProviderConfig(schema, { apiKey: 'line\nbreak' })).toThrow(/single line/);
		expect(() => splitProviderConfig(schema, {})).toThrow(/required/);
		expect(() => splitProviderConfig(schema, [] as never)).toThrow(/object/);
	});

	it('keeps the lines of a multi-line field', () => {
		const pem = '-----BEGIN PUBLIC KEY-----\nMFkw\n-----END PUBLIC KEY-----';
		expect(splitProviderConfig(schema, { apiKey: 'k', publicKey: `  ${pem}\n` }).config['publicKey']).toBe(pem);
	});
});
