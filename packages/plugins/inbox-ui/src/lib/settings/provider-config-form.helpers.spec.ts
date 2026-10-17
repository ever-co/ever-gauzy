import { IEmailProviderConfigSchema, IInboxProviderAccount } from '@gauzy/contracts';
import {
	initialProviderConfigState,
	PROVIDER_CONFIG_ERROR_KEYS,
	providerConfigErrors,
	providerConfigFields,
	providerConfigPayload
} from './provider-config-form.helpers';

/** A form like the provider plugins' (Postmark / SendGrid / SES): every kind of field the renderer knows. */
const schema: IEmailProviderConfigSchema = {
	type: 'object',
	properties: {
		apiKey: { type: 'string', title: 'API key', description: 'From the provider dashboard.', writeOnly: true },
		signingKey: { type: 'string', title: 'Signing key', writeOnly: true },
		webhookPassword: { type: 'string', title: 'Webhook password', generated: true },
		publicKey: { type: 'string', title: 'Public key', format: 'textarea' },
		fromAddress: { type: 'string', format: 'email' },
		endpoint: { type: 'string', format: 'uri' },
		region: { type: 'string', enum: ['us', 'eu'], default: 'us' },
		timeout: { type: 'integer', minimum: 1, maximum: 60, default: 10 },
		sandbox: { type: 'boolean', default: true },
		topicArn: { type: 'string', pattern: '^arn:aws:sns:' }
	},
	required: ['apiKey', 'webhookPassword', 'region']
};

const account = (overrides: Partial<IInboxProviderAccount> = {}): IInboxProviderAccount =>
	({
		id: 'account-1',
		providerId: 'fake',
		name: 'Fake',
		config: { fromAddress: 'support@acme.test', region: 'eu', timeout: 30, sandbox: false },
		secretsSet: ['apiKey', 'webhookPassword'],
		...overrides
	}) as IInboxProviderAccount;

describe('provider config form helpers', () => {
	it('turns the schema into fields with their controls, labels and required marks', () => {
		const fields = providerConfigFields(schema);
		expect(fields.map((field) => [field.name, field.control, field.inputType])).toEqual([
			['apiKey', 'secret', 'password'],
			['signingKey', 'secret', 'password'],
			['webhookPassword', 'generated', 'password'],
			['publicKey', 'textarea', 'text'],
			['fromAddress', 'text', 'email'],
			['endpoint', 'text', 'url'],
			['region', 'enum', 'text'],
			['timeout', 'number', 'number'],
			['sandbox', 'boolean', 'text'],
			['topicArn', 'text', 'text']
		]);
		const apiKey = fields[0];
		expect([apiKey.label, apiKey.description, apiKey.required, apiKey.secret]).toEqual([
			'API key',
			'From the provider dashboard.',
			true,
			true
		]);
		expect(fields.find((field) => field.name === 'fromAddress')?.label).toBe('fromAddress');
		expect(fields.find((field) => field.name === 'region')?.options).toEqual(['us', 'eu']);
		expect(providerConfigFields(null)).toEqual([]);
	});

	it('starts a new account from the defaults, and secrets empty', () => {
		expect(initialProviderConfigState(schema).values).toEqual({
			apiKey: '',
			signingKey: '',
			webhookPassword: '',
			publicKey: '',
			fromAddress: '',
			endpoint: '',
			region: 'us',
			timeout: '10',
			sandbox: true,
			topicArn: ''
		});
	});

	it('starts an edit from the stored public values, and never puts a stored secret in the form', () => {
		const state = initialProviderConfigState(schema, account());
		expect(state.values).toMatchObject({
			fromAddress: 'support@acme.test',
			region: 'eu',
			timeout: '30',
			sandbox: false
		});
		expect([state.values['apiKey'], state.values['webhookPassword']]).toEqual(['', '']);
		expect(state.reset).toEqual([]);
	});

	describe('checks', () => {
		it('a new account needs its required secrets typed; a generated one is the server’s', () => {
			const errors = providerConfigErrors(schema, initialProviderConfigState(schema));
			expect(errors).toEqual({ apiKey: { key: PROVIDER_CONFIG_ERROR_KEYS.REQUIRED } });
		});

		it('an edit keeps a stored required secret, unless it is cleared', () => {
			const stored = account();
			const state = initialProviderConfigState(schema, stored);
			expect(providerConfigErrors(schema, state, stored)).toEqual({});
			expect(providerConfigErrors(schema, { ...state, reset: ['apiKey'] }, stored)).toEqual({
				apiKey: { key: PROVIDER_CONFIG_ERROR_KEYS.REQUIRED }
			});
		});

		it('checks the values as the API does', () => {
			const state = initialProviderConfigState(schema);
			const values = {
				...state.values,
				apiKey: 'key',
				fromAddress: 'not-an-address',
				endpoint: 'http://plain.example.test/hook',
				timeout: '61',
				topicArn: 'arn:aws:s3:::bucket',
				region: null
			};
			expect(providerConfigErrors(schema, { values, reset: [] })).toEqual({
				fromAddress: { key: PROVIDER_CONFIG_ERROR_KEYS.EMAIL },
				endpoint: { key: PROVIDER_CONFIG_ERROR_KEYS.URL },
				timeout: { key: PROVIDER_CONFIG_ERROR_KEYS.MAX, params: { max: 60 } },
				topicArn: { key: PROVIDER_CONFIG_ERROR_KEYS.PATTERN },
				region: { key: PROVIDER_CONFIG_ERROR_KEYS.REQUIRED }
			});
			expect(
				providerConfigErrors(schema, { values: { ...values, timeout: '2.5', fromAddress: 'a\nb' }, reset: [] })
			).toMatchObject({
				timeout: { key: PROVIDER_CONFIG_ERROR_KEYS.INTEGER },
				fromAddress: { key: PROVIDER_CONFIG_ERROR_KEYS.SINGLE_LINE }
			});
		});

		it('a multi-line field takes several lines (a PEM key)', () => {
			const state = initialProviderConfigState(schema);
			const values = {
				...state.values,
				apiKey: 'key',
				publicKey: '-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----'
			};
			expect(providerConfigErrors(schema, { values, reset: [] })).toEqual({});
		});
	});

	describe('payload', () => {
		it('a new account: the typed values, numbers as numbers, nothing for an empty field or a generated secret', () => {
			const state = initialProviderConfigState(schema);
			const config = providerConfigPayload(schema, {
				values: { ...state.values, apiKey: 'key-1', fromAddress: ' support@acme.test ' },
				reset: []
			});
			expect(config).toEqual({
				apiKey: 'key-1',
				fromAddress: 'support@acme.test',
				region: 'us',
				timeout: 10,
				sandbox: true
			});
		});

		it('an edit: an empty secret is left out (kept), a typed one replaces, a reset one is sent as null', () => {
			const stored = account({ secretsSet: ['apiKey', 'signingKey', 'webhookPassword'] });
			const state = initialProviderConfigState(schema, stored);
			const config = providerConfigPayload(
				schema,
				{
					values: { ...state.values, signingKey: 'new-signing-key', fromAddress: '' },
					reset: ['webhookPassword']
				},
				stored
			);
			expect(config).not.toHaveProperty('apiKey');
			expect(config).toMatchObject({
				signingKey: 'new-signing-key',
				webhookPassword: null,
				// A stored public value emptied is cleared.
				fromAddress: null,
				region: 'eu',
				timeout: 30,
				sandbox: false
			});
			// An empty field that had no value is left out.
			expect(config).not.toHaveProperty('endpoint');
		});

		it('keeps a number option a number', () => {
			const numbers: IEmailProviderConfigSchema = {
				type: 'object',
				properties: { port: { type: 'integer', enum: [25, 587] } }
			};
			expect(providerConfigPayload(numbers, { values: { port: 587 }, reset: [] })).toEqual({ port: 587 });
		});
	});
});
