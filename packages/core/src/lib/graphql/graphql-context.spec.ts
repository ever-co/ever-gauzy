import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { RelationLoaderRegistry } from './batch/relation-loader.registry';
import { createGraphqlRequestContext } from './graphql-context';

/**
 * The context of a GraphQL operation is where the operation's scope is decided, so these cases are
 * about one question: can anything a caller writes change the tenant the rest of the operation runs
 * in? The answer has to be no, and it used to be yes.
 */
describe('createGraphqlRequestContext', () => {
	const TENANT_A = '11111111-1111-1111-1111-111111111111';
	const TENANT_B = '22222222-2222-2222-2222-222222222222';
	const ORGANIZATION_A = '33333333-3333-3333-3333-333333333333';
	const ORGANIZATION_B = '44444444-4444-4444-4444-444444444444';

	const credential = (tenantId: string | null, organizationId: string | null = null) => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId as never);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(organizationId as never);
	};

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('takes the tenant from the credential and not from the header', () => {
		credential(TENANT_A);

		const context = createGraphqlRequestContext({ headers: { 'tenant-id': TENANT_A } });

		expect(context.tenantId).toBe(TENANT_A);
	});

	it('refuses a Tenant-Id header that names a tenant other than the credential', () => {
		credential(TENANT_A);

		// The whole point: `Tenant-Id` is in the endpoint's CORS allowedHeaders, so any browser client
		// can send it. Reading it in preference to the credential made every resolver, loader and field
		// gate that scopes on `context.tenantId` act in the tenant the caller asked for.
		let thrown: unknown;

		try {
			createGraphqlRequestContext({ headers: { 'tenant-id': TENANT_B } });
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(ApiException);
		expect((thrown as ApiException).code).toBe(ApiErrorCode.TENANT_MISMATCH);
		expect((thrown as ApiException).getStatus()).toBe(403);
	});

	it('refuses an Organization-Id header that names another organization', () => {
		credential(TENANT_A, ORGANIZATION_A);

		expect(() =>
			createGraphqlRequestContext({ headers: { 'tenant-id': TENANT_A, 'organization-id': ORGANIZATION_B } })
		).toThrow(ApiException);
	});

	it('accepts a header that repeats the credential, which is what existing clients send', () => {
		credential(TENANT_A, ORGANIZATION_A);

		const context = createGraphqlRequestContext({
			headers: { 'Tenant-Id': TENANT_A, 'Organization-Id': ORGANIZATION_A }
		});

		expect(context.tenantId).toBe(TENANT_A);
		expect(context.organizationId).toBe(ORGANIZATION_A);
	});

	it('leaves an unauthenticated operation alone, so the public surface is not closed by this check', () => {
		credential(null);

		const context = createGraphqlRequestContext({ headers: { 'tenant-id': TENANT_B } });

		expect(context.tenantId).toBeUndefined();
	});

	it('gives every operation its own loader registry', () => {
		credential(TENANT_A);

		const first = createGraphqlRequestContext();
		const second = createGraphqlRequestContext();

		expect(first.loaders).toBeInstanceOf(RelationLoaderRegistry);
		expect(first.loaders).not.toBe(second.loaders);
	});

	it('qualifies every loader key with the operation’s own scope', () => {
		credential(TENANT_A, ORGANIZATION_A);
		const inTenantA = createGraphqlRequestContext();

		credential(TENANT_B, ORGANIZATION_B);
		const inTenantB = createGraphqlRequestContext();

		// A resolver that keys a loader on the relation alone is the ordinary case, and the key it
		// writes must not be a key another tenant could also write. The registries are separate
		// objects per request, so this is belt and braces — but a shared registry is exactly the kind
		// of optimisation somebody adds later, and the key is what has to survive it.
		expect(inTenantA.loaders.scopeKey).not.toBe(inTenantB.loaders.scopeKey);
		expect(inTenantA.loaders.scopeKey).toContain(TENANT_A);
		expect(inTenantA.loaders.scopeKey).toContain(ORGANIZATION_A);
	});

	it('keeps the caller’s key readable when there is no scope to qualify it with', () => {
		const registry = new RelationLoaderRegistry();

		registry.for('order_line:orderId', async (keys) => keys.map(() => []));

		expect(registry.keys).toEqual(['order_line:orderId']);
		expect(registry.has('order_line:orderId')).toBe(true);
	});

	it('answers the same loader for one key and different loaders across two scopes', async () => {
		const batch = async (keys: readonly string[]) => keys.map(() => []);
		const inTenantA = new RelationLoaderRegistry({ scope: { tenantId: TENANT_A } });
		const inTenantB = new RelationLoaderRegistry({ scope: { tenantId: TENANT_B } });

		expect(inTenantA.for('order_line:orderId', batch)).toBe(inTenantA.for('order_line:orderId', batch));
		expect(inTenantA.keys[0]).not.toBe(inTenantB.keys[0]);
	});
});
