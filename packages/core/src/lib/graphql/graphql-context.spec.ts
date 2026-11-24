import { RequestContext } from '../core/context/request-context';
import { RelationLoaderRegistry } from './batch/relation-loader.registry';
import { createGraphqlRequestContext, renewRelationLoaders } from './graphql-context';

/**
 * The context of a GraphQL operation is where the operation's scope is exposed to resolvers, so these
 * cases are about one question: can anything a caller writes change the tenant or the organization a
 * resolver reads from it? The answer has to be no, and it used to be yes.
 */
describe('createGraphqlRequestContext', () => {
	const TENANT_A = '11111111-1111-1111-1111-111111111111';
	const TENANT_B = '22222222-2222-2222-2222-222222222222';
	const ORGANIZATION_A = '33333333-3333-3333-3333-333333333333';
	const ORGANIZATION_B = '44444444-4444-4444-4444-444444444444';

	/** Stands in for the credential the `AuthGuard` attaches to the request. */
	const credential = (tenantId: string | null, organizationId: string | null = null) => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId as never);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(organizationId as never);
	};

	/** What Apollo does to the factory's result before every operation (`cloneObject`). */
	const cloneLikeApollo = <T extends object>(object: T): T =>
		Object.assign(Object.create(Object.getPrototypeOf(object)), object);

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('takes the tenant from the credential and not from a Tenant-Id header that names another', () => {
		credential(TENANT_A);

		// `Tenant-Id` is in the endpoint's CORS allowedHeaders, so any browser client can send it.
		const context = createGraphqlRequestContext({ req: { headers: { 'tenant-id': TENANT_B } } });

		expect(context.tenantId).toBe(TENANT_A);
	});

	it('takes the organization from the credential and not from an Organization-Id header', () => {
		credential(TENANT_A, ORGANIZATION_A);

		const context = createGraphqlRequestContext({
			req: { headers: { 'tenant-id': TENANT_A, 'organization-id': ORGANIZATION_B } }
		});

		expect(context.organizationId).toBe(ORGANIZATION_A);
	});

	it('never lets a header supply a scope the credential does not have', () => {
		credential(null);

		const context = createGraphqlRequestContext({
			headers: { 'Tenant-Id': TENANT_B, 'Organization-Id': ORGANIZATION_B }
		});

		expect(context.tenantId).toBeUndefined();
		expect(context.organizationId).toBeUndefined();
	});

	it('reads the credential when the scope is asked for, which is after the guards attached it', () => {
		// The driver builds the context before the operation executes, and the `AuthGuard` that attaches
		// the user runs inside each resolver — so at construction there is no credential yet.
		credential(null);
		const context = createGraphqlRequestContext({ req: { headers: { 'tenant-id': TENANT_B } } });

		credential(TENANT_A, ORGANIZATION_A);

		expect(context.tenantId).toBe(TENANT_A);
		expect(context.organizationId).toBe(ORGANIZATION_A);
	});

	it('keeps reading the credential in the copy Apollo hands each operation', () => {
		credential(null);
		const operationContext = cloneLikeApollo(createGraphqlRequestContext({ req: { headers: {} } }));

		credential(TENANT_A, ORGANIZATION_A);

		// An own getter would have been evaluated by `Object.assign` at clone time, before any guard ran,
		// and frozen as `undefined`.
		expect(operationContext.tenantId).toBe(TENANT_A);
		expect(operationContext.organizationId).toBe(ORGANIZATION_A);
		expect(operationContext.loaders).toBeInstanceOf(RelationLoaderRegistry);
	});

	it('uses a scope the caller of the factory resolved itself', () => {
		credential(TENANT_B, ORGANIZATION_B);

		const context = createGraphqlRequestContext({ tenantId: TENANT_A, organizationId: ORGANIZATION_A });

		expect(context.tenantId).toBe(TENANT_A);
		expect(context.organizationId).toBe(ORGANIZATION_A);
	});

	it('still reads the channel a caller states, which is a statement the channel guards check', () => {
		credential(TENANT_A);

		expect(createGraphqlRequestContext({ req: { headers: { 'X-Channel-Id': 'web' } } }).channelId).toBe('web');
		expect(createGraphqlRequestContext({ headers: { 'x-channel-id': 'pos' } }).channelId).toBe('pos');
	});

	it('keeps the request on the context, where the guards read it', () => {
		const req = { headers: {} };

		expect(createGraphqlRequestContext({ req }).req).toBe(req);
	});

	it('gives every operation its own loader registry', () => {
		const first = createGraphqlRequestContext();
		const second = createGraphqlRequestContext();

		expect(first.loaders).toBeInstanceOf(RelationLoaderRegistry);
		expect(first.loaders).not.toBe(second.loaders);
	});
});

/**
 * A subscription is one operation whose stream graphql-js executes event after event with one context, so the transport
 * hands that context a fresh registry before each event (`renewRelationLoadersPerPull`,
 * `renewRelationLoadersPerFilter`). These cases are about what the hand-over does to the context and to the registry it
 * replaces.
 */
describe('renewRelationLoaders', () => {
	/** What Apollo does to the factory's result before every operation (`cloneObject`). */
	const cloneLikeApollo = <T extends object>(object: T): T =>
		Object.assign(Object.create(Object.getPrototypeOf(object)), object);

	it('hands the context an empty registry with the defaults of the one it replaces', async () => {
		const batches: number[][] = [];
		const context = createGraphqlRequestContext({ loaders: new RelationLoaderRegistry({ maxBatchSize: 1 }) });
		const previous = context.loaders;
		const batch = async (keys: readonly number[]) => {
			batches.push([...keys]);
			return keys.map((key) => `v${key}`);
		};
		await previous.for('relation:key', batch).load(1);

		const renewed = renewRelationLoaders(context);

		expect(renewed).toBeInstanceOf(RelationLoaderRegistry);
		expect(context.loaders).toBe(renewed);
		expect(renewed).not.toBe(previous);
		expect(renewed?.size).toBe(0);

		// The cached key is read again, and the batch size of the registry it replaces still applies.
		await expect(context.loaders.for('relation:key', batch).loadMany([1, 2])).resolves.toEqual(['v1', 'v2']);
		expect(batches).toEqual([[1], [1], [2]]);
	});

	it('leaves the replaced registry working: a batch in flight settles there, not in the new one', async () => {
		let answer: (values: string[]) => void = () => undefined;
		const context = createGraphqlRequestContext();
		const previous = context.loaders;
		const late = previous
			.for<string, string>('relation:key', () => new Promise<string[]>((resolve) => (answer = resolve)))
			.load('k');
		await Promise.resolve();

		renewRelationLoaders(context);
		answer(['before']);

		// Nothing waiting on the earlier registry is failed, and what it answers is not what the next event reads.
		await expect(late).resolves.toBe('before');
		expect(previous.stats.loaders).toBe(1);
		expect(context.loaders.has('relation:key')).toBe(false);
		await expect(
			context.loaders.for<string, string>('relation:key', async (keys) => keys.map(() => 'after')).load('k')
		).resolves.toBe('after');
	});

	it('renews the copy Apollo hands an operation, not the object it was copied from', () => {
		const original = createGraphqlRequestContext();
		const copy = cloneLikeApollo(original);

		const renewed = renewRelationLoaders(copy);

		expect(copy.loaders).toBe(renewed);
		expect(original.loaders).not.toBe(renewed);
	});

	it('leaves a context the factory did not build as it is', () => {
		const loaders = new RelationLoaderRegistry();
		const context = { loaders };

		expect(renewRelationLoaders(context)).toBeUndefined();
		expect(context.loaders).toBe(loaders);
		expect(renewRelationLoaders(undefined)).toBeUndefined();
		expect(renewRelationLoaders(null)).toBeUndefined();
	});
});
