/**
 * `@gauzy/core` boots the whole application graph from its barrel, so it is doubled at the module boundary as
 * the package's other suites double it. The service under test is the real one, over a store double that
 * applies the order it is asked for and answers the rows that order leaves tied in a different order on every
 * read — which is what a database is free to do with them.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		TenantAwareCrudService: class {
			constructor(
				protected readonly typeOrmRepository: any,
				protected readonly mikroOrmRepository?: any
			) {}
		},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		VersionedColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		...jest.requireActual('@gauzy/core/src/lib/money/decimal'),
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => 'tenant-1',
			currentOrganizationId: () => 'organization-1'
		}
	};
});

import { OrderLineInvoiceService } from './order-line-invoice.service';

/**
 * The links of one order line are read in a total order.
 *
 * `orderLineInvoices` pages a line's links with offset cursors, and the read stated `createdAt` alone. One
 * accounting document bills several lines — and a bridge that records a deposit and its balance in one pass
 * writes two links of one line within one clock tick — so rows that tie on `createdAt` came back in whatever
 * order the store chose on that read, and a cursor walk could answer one link twice and another never. The
 * read now ends its order with the primary key.
 */
describe('OrderLineInvoiceService — the order a line’s links are read in', () => {
	const at = new Date('2026-09-01T10:00:00.000Z');
	const rows = [
		{ id: 'link-b', orderLineId: 'line-1', createdAt: at },
		{ id: 'link-0', orderLineId: 'line-1', createdAt: new Date('2026-09-01T09:00:00.000Z') },
		{ id: 'link-c', orderLineId: 'line-1', createdAt: at },
		{ id: 'link-a', orderLineId: 'line-1', createdAt: at }
	];

	/**
	 * A store that sorts by the columns it is asked for and leaves a tie in a different order on every read.
	 */
	function store() {
		const reads: any[] = [];

		return {
			reads,
			find: jest.fn(async (options: any = {}) => {
				reads.push(options);

				const shift = reads.length % rows.length;
				const answered = [...rows.slice(shift), ...rows.slice(0, shift)].map((row) => ({ ...row }));
				const columns = Object.entries(options.order ?? {}) as Array<[string, string]>;

				return answered.sort((left: any, right: any) => {
					for (const [column, direction] of columns) {
						const a = left[column] instanceof Date ? left[column].getTime() : left[column];
						const b = right[column] instanceof Date ? right[column].getTime() : right[column];

						if (a !== b) {
							return (a > b ? 1 : -1) * (direction === 'DESC' ? -1 : 1);
						}
					}

					return 0;
				});
			})
		};
	}

	it('answers the same links in the same order on every read, the tie broken by the id', async () => {
		const repository = store();
		const service = new OrderLineInvoiceService(repository as never, {} as never, {} as never, {} as never);

		for (let read = 0; read < rows.length; read++) {
			expect((await service.listForLine('line-1')).map((row) => row.id)).toEqual([
				'link-0',
				'link-a',
				'link-b',
				'link-c'
			]);
		}
	});

	it('states the total order to the store, in the caller’s scope, with retired links only when asked', async () => {
		const repository = store();
		const service = new OrderLineInvoiceService(repository as never, {} as never, {} as never, {} as never);

		await service.listForLine('line-1');
		await service.listForLine('line-1', true);

		expect(repository.reads[0]).toEqual({
			where: { orderLineId: 'line-1', tenantId: 'tenant-1', organizationId: 'organization-1' },
			order: { createdAt: 'ASC', id: 'ASC' }
		});
		expect(repository.reads[1]).toMatchObject({ order: { createdAt: 'ASC', id: 'ASC' }, withDeleted: true });
	});
});
