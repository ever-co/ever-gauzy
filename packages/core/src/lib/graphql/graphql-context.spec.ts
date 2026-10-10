import { RequestContext } from '../core/context/request-context';
import { RelationLoaderRegistry } from './batch/relation-loader.registry';
import { createGraphqlRequestContext } from './graphql-context';

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
