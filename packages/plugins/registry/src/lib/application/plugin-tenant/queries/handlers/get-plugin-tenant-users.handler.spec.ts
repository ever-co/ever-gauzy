// `@gauzy/core` drags in the entity graph; the handler only reads the caller from the request context.
const mockContext = { userId: 'user-a', tenantId: 'tenant-a' as string | null };
jest.mock('@gauzy/core', () => ({
	RequestContext: {
		currentUserId: () => mockContext.userId,
		currentTenantId: () => mockContext.tenantId
	},
	// The real helper is covered in core; here only that the handler applies it to each row's avatar.
	withoutDummyImageHost: (value: unknown) =>
		typeof value === 'string' && value.includes('dummyimage.com')
			? 'https://api.example.com/api/placeholder'
			: value
}));

import { GetPluginTenantUsersQuery } from '../get-plugin-tenant-users.query';
import { GetPluginTenantUsersHandler } from './get-plugin-tenant-users.handler';

const PLUGIN_TENANT = '11111111-1111-4111-8111-111111111111';

type Params = (string | number)[];

/** A data source whose count query answers `total` and whose page query answers no rows. */
function dataSource(total = 1) {
	return {
		query: jest.fn(async (sql: string, _params: Params) => (sql.includes('COUNT(*)') ? [{ total }] : []))
	};
}

/** The SQL and parameters of the `index`-th query the handler ran. */
function queryAt(source: ReturnType<typeof dataSource>, index: number): [string, Params] {
	const call = source.query.mock.calls[index];
	if (!call) {
		throw new Error(`no query #${index}`);
	}
	return call;
}

describe('GetPluginTenantUsersHandler tenant scoping', () => {
	beforeEach(() => {
		mockContext.userId = 'user-a';
		mockContext.tenantId = 'tenant-a';
	});

	it.each(['allowed', 'denied', 'all'] as const)(
		'binds every %s branch to the caller’s tenant, so another tenant’s plugin-tenant id reads nothing',
		async (userType) => {
			const source = dataSource();

			await new GetPluginTenantUsersHandler(source as any).execute(
				new GetPluginTenantUsersQuery(PLUGIN_TENANT, userType, 0, 20, 'ann')
			);

			expect(source.query).toHaveBeenCalledTimes(2);
			for (const [sql, params] of source.query.mock.calls) {
				const branches = userType === 'all' ? 2 : 1;
				// Every branch of the union carries the clause, not just the first.
				expect(sql.match(/pt\."tenantId" = \$3/g)).toHaveLength(branches);
				expect(params.slice(0, 4)).toEqual([PLUGIN_TENANT, 'user-a', 'tenant-a', '%ann%']);
				// The search term keeps its own placeholder after the tenant's.
				expect(sql).toContain('LIKE $4');
			}
		}
	);

	it('takes the tenant from the request context, never from the query', async () => {
		mockContext.tenantId = 'tenant-b';
		const source = dataSource();

		await new GetPluginTenantUsersHandler(source as any).execute(new GetPluginTenantUsersQuery(PLUGIN_TENANT));

		expect(queryAt(source, 0)[1][2]).toBe('tenant-b');
	});

	it('pages after the tenant and search parameters', async () => {
		const source = dataSource(3);

		await new GetPluginTenantUsersHandler(source as any).execute(
			new GetPluginTenantUsersQuery(PLUGIN_TENANT, 'all', 10, 5)
		);

		const [sql, params] = queryAt(source, 1);
		expect(params).toEqual([PLUGIN_TENANT, 'user-a', 'tenant-a', 5, 10]);
		expect(sql).toContain('LIMIT $4');
		expect(sql).toContain('OFFSET $5');
	});

	it('replaces a stored dummyimage.com avatar by the first-party placeholder (raw rows skip the user subscriber)', async () => {
		const source = {
			query: jest.fn(async (sql: string) =>
				sql.includes('COUNT(*)')
					? [{ total: 2 }]
					: [
							{
								id: 'u1',
								imageUrl: 'https://dummyimage.com/330x300/269aff/ffffff.jpg&text=A',
								accessType: 'allowed'
							},
							{ id: 'u2', imageUrl: 'https://cdn.example.com/u2.png', accessType: 'denied' }
						]
			)
		};

		const { items } = await new GetPluginTenantUsersHandler(source as any).execute(
			new GetPluginTenantUsersQuery(PLUGIN_TENANT)
		);

		expect(items.map(({ imageUrl }) => imageUrl)).toEqual([
			'https://api.example.com/api/placeholder',
			'https://cdn.example.com/u2.png'
		]);
	});

	it('reads nothing, and runs no query, when the request carries no tenant', async () => {
		mockContext.tenantId = null;
		const source = dataSource();

		await expect(
			new GetPluginTenantUsersHandler(source as any).execute(new GetPluginTenantUsersQuery(PLUGIN_TENANT))
		).resolves.toEqual({ items: [], total: 0 });
		expect(source.query).not.toHaveBeenCalled();
	});
});
