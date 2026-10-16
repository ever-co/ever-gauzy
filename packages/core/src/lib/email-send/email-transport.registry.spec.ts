import { EmailTransportRegistry, IEmailTransportResolver, getEmailTransportRegistry } from './email-transport.registry';

/** A resolver that answers `transport` for every request (or `null`), recording what it was asked. */
function resolver(id: string, answer: unknown, asked: unknown[] = []): IEmailTransportResolver {
	return {
		id,
		resolve: async (request) => {
			asked.push(request);
			return answer as any;
		}
	};
}

describe('EmailTransportRegistry', () => {
	const transport = { name: 'test', version: '1', send: jest.fn() };

	it('answers null and asks nothing when no resolver is registered (the SMTP chain then sends)', async () => {
		const registry = new EmailTransportRegistry();
		expect(registry.size).toBe(0);
		await expect(registry.resolve({ tenantId: 't' })).resolves.toBeNull();
	});

	it('asks the resolvers in registration order and answers the first transport', async () => {
		const registry = new EmailTransportRegistry();
		const askedFirst: unknown[] = [];
		const askedSecond: unknown[] = [];
		registry.register(resolver('first', null, askedFirst));
		registry.register(
			resolver('second', { transport, fromAddress: 'team@acme.test', source: 'resend:acct-1' }, askedSecond)
		);
		registry.register(resolver('third', { transport: { other: true }, source: 'never' }));

		const resolution = await registry.resolve({ tenantId: 't', organizationId: 'o', providerAccountId: 'a' });

		expect(resolution).toEqual({ transport, fromAddress: 'team@acme.test', source: 'resend:acct-1' });
		expect(askedFirst).toEqual([{ tenantId: 't', organizationId: 'o', providerAccountId: 'a' }]);
		expect(askedSecond).toHaveLength(1);
	});

	it('names the resolver as the source when the resolution states none', async () => {
		const registry = new EmailTransportRegistry();
		registry.register(resolver('inbox', { transport }));
		await expect(registry.resolve({ tenantId: 't' })).resolves.toMatchObject({ source: 'inbox' });
	});

	it('skips a resolver that throws, so a broken provider account never stops mail', async () => {
		const registry = new EmailTransportRegistry();
		registry.register({
			id: 'broken',
			resolve: async () => {
				throw new Error('decrypt failed for billing@acme.test');
			}
		});
		registry.register(resolver('working', { transport, source: 'working' }));
		await expect(registry.resolve({ tenantId: 't' })).resolves.toMatchObject({ source: 'working' });
	});

	it('skips an answer that carries no transport', async () => {
		const registry = new EmailTransportRegistry();
		registry.register(resolver('empty', { transport: null, source: 'empty' }));
		registry.register(resolver('scalar', { transport: 'smtp://x', source: 'scalar' }));
		await expect(registry.resolve({ tenantId: 't' })).resolves.toBeNull();
	});

	it('refuses a second resolver under a taken id, and takes the same resolver again as a no-op', () => {
		const registry = new EmailTransportRegistry();
		const one = resolver('inbox', null);
		registry.register(one);
		registry.register(one);
		expect(() => registry.register(resolver('inbox', null))).toThrow(/already registered/);
		expect(registry.ids()).toEqual(['inbox']);
	});

	it('refuses a resolver without an id or a resolve function', () => {
		const registry = new EmailTransportRegistry();
		expect(() => registry.register({ id: ' ', resolve: async () => null })).toThrow();
		expect(() => registry.register({ id: 'x' } as any)).toThrow();
	});

	it('unregisters a resolver', async () => {
		const registry = new EmailTransportRegistry();
		registry.register(resolver('inbox', { transport }));
		registry.unregister('inbox');
		expect(registry.size).toBe(0);
		await expect(registry.resolve({ tenantId: 't' })).resolves.toBeNull();
	});

	it('is one registry per process', () => {
		expect(getEmailTransportRegistry()).toBe(getEmailTransportRegistry());
	});
});
