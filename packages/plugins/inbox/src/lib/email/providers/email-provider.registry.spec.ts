import { EmailProviderRegistry } from './email-provider.registry';
import { IEmailProviderPlugin } from './email-provider.types';

function provider(overrides: Partial<IEmailProviderPlugin> = {}): IEmailProviderPlugin {
	return {
		id: 'resend',
		displayName: 'Resend',
		capabilities: { inbound: true, outbound: true, customDomains: true },
		configSchema: { type: 'object', properties: {} },
		inbound: { verify: async () => undefined, parse: async () => [] },
		createTransport: () => ({ name: 'resend', version: '1', send: () => undefined }),
		...overrides
	};
}

describe('EmailProviderRegistry', () => {
	it('registers, describes (sorted, no handlers) and unregisters providers', () => {
		const registry = new EmailProviderRegistry();
		registry.register(provider());
		registry.register(provider({ id: 'mailgun', displayName: 'Mailgun' }));
		expect(registry.describe().map((d) => d.id)).toEqual(['mailgun', 'resend']);
		expect(Object.keys(registry.describe()[0] as object)).toEqual([
			'id',
			'displayName',
			'capabilities',
			'configSchema'
		]);
		registry.unregister('mailgun');
		expect(registry.list().map((p) => p.id)).toEqual(['resend']);
	});

	it('takes the same provider twice and refuses a second one under a taken id', () => {
		const registry = new EmailProviderRegistry();
		const resend = provider();
		registry.register(resend);
		registry.register(resend);
		expect(() => registry.register(provider())).toThrow(/already registered/);
	});

	it('refuses an id that cannot be part of a webhook URL, and capabilities without their handlers', () => {
		const registry = new EmailProviderRegistry();
		expect(() => registry.register(provider({ id: 'Resend' }))).toThrow(/id/);
		expect(() => registry.register(provider({ id: 'a/b' }))).toThrow(/id/);
		expect(() => registry.register(provider({ inbound: undefined }))).toThrow(/inbound/);
		expect(() => registry.register(provider({ createTransport: undefined }))).toThrow(/transport/);
		expect(() => registry.register(provider({ configSchema: undefined as never }))).toThrow(/config schema/);
	});
});
