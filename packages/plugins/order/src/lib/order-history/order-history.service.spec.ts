/**
 * `@gauzy/core` boots the whole application graph from its barrel, so it is doubled at the module boundary as
 * the package's other suites double it. The service under test is the real one; the base CRUD class is the
 * double, over a store that answers tied rows in a different order on every read — which is what a database
 * is free to do with rows its `ORDER BY` does not separate.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		async findAll(options: any = {}): Promise<any> {
			const items = await this.typeOrmRepository.find(options);

			return { items, total: items.length };
		}
	}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		TenantAwareCrudService,
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
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		wrapSerialize: (entity: unknown) => entity,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null
		}
	};
});

import { OrderHistoryService } from './order-history.service';

/**
 * The order's timeline is read in a total order.
 *
 * `orderHistory` pages the timeline with offset cursors, so the order the rows come back in has to be one no
 * read can rearrange. The read stated none and sorted the rows in memory by `createdAt` alone — and one move
 * writes several entries in the same instant (a change's request, its note and its confirmation arrive within
 * one clock tick on a fast store), so the rows it could not separate kept whatever order the store happened to
 * answer them in. Two reads of the same timeline could then page differently: a cursor walk repeated one entry
 * and never answered another. The store is now asked for `createdAt, id`, and the sort in memory breaks the tie
 * on the id too.
 */
describe('OrderHistoryService — the timeline’s order', () => {
	const at = '2026-09-01T10:00:00.000Z';
	const rows = [
		{ id: 'entry-c', orderId: 'order-1', action: 'CHANGE_CONFIRMED', createdAt: new Date(at) },
		{ id: 'entry-a', orderId: 'order-1', action: 'CHANGE_REQUESTED', createdAt: new Date(at) },
		{ id: 'entry-0', orderId: 'order-1', action: 'ORDER_PLACED', createdAt: new Date('2026-09-01T09:00:00.000Z') },
		{ id: 'entry-b', orderId: 'order-1', action: 'NOTE_ADDED', createdAt: new Date(at) }
	];

	/**
	 * A store that answers the rows in a different order on every read, as a database may for rows its order
	 * leaves tied, and records what it was asked.
	 */
	function store() {
		const reads: any[] = [];

		return {
			reads,
			find: jest.fn(async (options: any = {}) => {
				reads.push(options);

				// Every read rotates the rows, so no two consecutive reads agree on the ties.
				const shift = reads.length % rows.length;

				return [...rows.slice(shift), ...rows.slice(0, shift)].map((row) => ({ ...row }));
			})
		};
	}

	it('answers the same entries in the same order on every read, the tie broken by the id', async () => {
		const repository = store();
		const service = new OrderHistoryService(repository as never, {} as never);
		const expected = ['entry-0', 'entry-a', 'entry-b', 'entry-c'];

		for (let read = 0; read < rows.length; read++) {
			expect((await service.timeline('order-1')).map((row) => row.id)).toEqual(expected);
		}
	});

	it('asks the store for the total order, and for the retired entries only when told to', async () => {
		const repository = store();
		const service = new OrderHistoryService(repository as never, {} as never);

		await service.timeline('order-1');
		await service.timeline('order-1', true);

		expect(repository.reads[0]).toMatchObject({
			where: { orderId: 'order-1' },
			order: { createdAt: 'ASC', id: 'ASC' }
		});
		expect('withDeleted' in repository.reads[0]).toBe(false);
		expect(repository.reads[1]).toMatchObject({ order: { createdAt: 'ASC', id: 'ASC' }, withDeleted: true });
	});
});
