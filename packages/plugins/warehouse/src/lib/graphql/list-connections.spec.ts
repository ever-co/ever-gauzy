/**
 * The three list root fields of this plugin that answer the platform's one connection contract.
 *
 * `warehouseBinSubtree`, `warehouseBinContents` and `pickListLines` each answered a bare array, which a
 * client can neither page nor count: the whole subtree, the whole contents and the whole line set were
 * answered to every caller however many rows it asked for, and nothing said whether more existed. They
 * now answer a connection, and the page is cut from the rows the service answered with — those methods
 * return every matching row in the order they mean and take no window of their own, so a resolver that
 * handed one down would be passing an argument the method does not accept while its `pageInfo` claimed a
 * page had been taken.
 *
 * The module boundaries are doubled for the reason this package's service specs state: `@gauzy/core`
 * boots the whole application graph from its barrel. Three things are deliberately real, because they are
 * what this suite is about: **the connection helpers are the kernel's own** (a double would let the page
 * arithmetic drift from the contract in a suite that still passed, which is the class of defect this
 * conversion removed), the resolvers are the package's own, and the SDL is the document the endpoint
 * composes.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: nothing here is mapped onto a module graph. */
	const decorator = () => () => undefined;

	return {
		Permissions: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		// The feature gate the resolvers append to their guard chain: `@UseGuards` is real here (it is
		// Nest's, not one of the no-ops), and it refuses an argument that is not a guard.
		FeatureFlagGuard: class {},
		// The two conventions the decorated methods carry are decorator factories and nothing more: the
		// guard and the interceptor they attach are application providers, and no application boots here.
		Versioned: decorator,
		Idempotent: decorator,
		// The page window, the row slicer and the connection are taken from the kernel rather than
		// restated, as are the cursors and the caps this package's own `pagination` module re-exports.
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		paginateRows: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').paginateRows,
		decodeOffsetCursor: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').decodeOffsetCursor,
		encodeOffsetCursor: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').encodeOffsetCursor,
		DEFAULT_CONNECTION_PAGE_SIZE: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.DEFAULT_CONNECTION_PAGE_SIZE,
		MAX_CONNECTION_PAGE_SIZE: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.MAX_CONNECTION_PAGE_SIZE
	};
});

jest.mock('../warehouse-bin/warehouse-bin.service', () => ({ WarehouseBinService: class WarehouseBinService {} }));
jest.mock('../warehouse-zone/warehouse-zone.service', () => ({ WarehouseZoneService: class WarehouseZoneService {} }));
jest.mock('../pick-list-line/pick-list-line.service', () => ({ PickListLineService: class PickListLineService {} }));

import { print } from 'graphql';
import { PickListLineResolver } from './resolvers/pick-list-line.resolver';
import { WarehouseBinResolver } from './resolvers/warehouse-bin.resolver';
import { schemaExtensions } from './schema-extensions';

/** The SDL as printed, so a declaration can be read the way a client reads it. */
const printed = print(schemaExtensions);

/**
 * @param name A type's name.
 * @returns The declarations between its braces, or an empty string when the document declares no such
 * type — which fails the assertion that reads it rather than passing silently.
 */
function bodyOf(name: string): string {
	return new RegExp(`type ${name} \\{([^}]*)\\}`).exec(printed)?.[1] ?? '';
}

/**
 * The three converted fields: the root field, the arguments it keeps, and the connection, edge and row
 * type each of them declares.
 */
const CONVERTED: ReadonlyArray<readonly [string, string, string, string, string]> = [
	['warehouseBinSubtree', 'id: ID!', 'WarehouseBinSubtreeConnection', 'WarehouseBinSubtreeEdge', 'WarehouseBin'],
	[
		'warehouseBinContents',
		'id: ID!',
		'WarehouseBinContentsConnection',
		'WarehouseBinContentsEdge',
		'WarehouseBinBalance'
	],
	['pickListLines', 'pickListId: ID!', 'PickListLinesConnection', 'PickListLinesEdge', 'PickListLine']
];

describe('the warehouse schema — the converted list fields answer connections', () => {
	it('declares each of them as the canonical connection, with the edge that addresses its rows', () => {
		for (const [field, argument, connection, edge, node] of CONVERTED) {
			const connectionBody = bodyOf(connection);
			const edgeBody = bodyOf(edge);

			expect(connectionBody).toMatch(new RegExp(`nodes: \\[${node}!\\]!`));
			expect(connectionBody).toMatch(new RegExp(`edges: \\[${edge}!\\]!`));
			expect(connectionBody).toMatch(/totalCount: Int!/);
			expect(connectionBody).toMatch(/pageInfo: PageInfo!/);

			expect(edgeBody).toMatch(new RegExp(`node: ${node}!`));
			expect(edgeBody).toMatch(/cursor: String!/);

			// The root field answers the connection, keeps the argument it already took, and takes the page
			// the connection is walked with — the one way a caller states how much of the set it wants.
			expect(printed).toContain(`${field}(${argument}, page: PageInput): ${connection}!`);
			// The bare array it used to answer, which a client could neither page nor count.
			expect(printed).not.toMatch(new RegExp(`${field}\\([^)]*\\): \\[`));
		}
	});
});

describe('the warehouse resolvers — the page is the one the caller asked for', () => {
	it('pages a bin’s subtree from the rows the traversal answered with, in the traversal’s order', async () => {
		const bins = [{ id: 'bin-1' }, { id: 'bin-2' }, { id: 'bin-3' }];
		const service = { findSubtree: jest.fn().mockResolvedValue(bins) };
		const resolver = new WarehouseBinResolver(service as any, {} as any);

		const first = await resolver.warehouseBinSubtree('rack', { first: 2 });

		// No window reaches the service: the traversal takes an id and answers the whole subtree, so a
		// resolver that stated one would state something the method cannot honour.
		expect(service.findSubtree).toHaveBeenCalledWith('rack');
		expect(first.nodes).toEqual([bins[0], bins[1]]);
		expect(first.totalCount).toBe(3);
		expect(first.edges).toEqual([
			{ node: bins[0], cursor: first.pageInfo.startCursor },
			{ node: bins[1], cursor: first.pageInfo.endCursor }
		]);
		expect(first.pageInfo.hasNextPage).toBe(true);

		// The walk the boundary cursor exists for: the next page holds what the first did not, once.
		const second = await resolver.warehouseBinSubtree('rack', {
			first: 2,
			after: first.pageInfo.endCursor as string
		});

		expect(second.nodes).toEqual([bins[2]]);
		expect(second.totalCount).toBe(3);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
		expect(second.pageInfo.hasNextPage).toBe(false);
	});

	it('pages a bin’s derived contents, counting every balance the ledger answered with', async () => {
		const balances = [
			{ variantId: 'variant-1', quantity: '1.000000' },
			{ variantId: 'variant-2', quantity: '2.000000' }
		];
		const service = { findContents: jest.fn().mockResolvedValue(balances) };
		const resolver = new WarehouseBinResolver(service as any, {} as any);

		const connection = await resolver.warehouseBinContents('bin-1', { limit: 1, offset: 1 });

		expect(service.findContents).toHaveBeenCalledWith('bin-1');
		expect(connection.nodes).toEqual([balances[1]]);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.hasPreviousPage).toBe(true);
		expect(connection.pageInfo.hasNextPage).toBe(false);
	});

	it('pages a pick list’s lines, and refuses a window the protocol cannot honour', async () => {
		const lines = [{ id: 'line-1' }, { id: 'line-2' }];
		const service = { findForList: jest.fn().mockResolvedValue(lines) };
		const resolver = new PickListLineResolver(service as any, {} as any);

		const connection = await resolver.pickListLines('list-1', { first: 1 });

		expect(service.findForList).toHaveBeenCalledWith('list-1');
		expect(connection.nodes).toEqual([lines[0]]);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.hasNextPage).toBe(true);

		// A refusal is the kernel's, and it is not caught here: answering a request that states both
		// directions with the first page is how a client is handed rows it did not ask for.
		await expect(resolver.pickListLines('list-1', { first: 1, last: 1 })).rejects.toThrow(
			/PAGINATION_DIRECTION_CONFLICT/
		);
	});
});
