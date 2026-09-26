/**
 * Two module boundaries are doubled here. `@gauzy/core` boots the whole application graph from its
 * barrel — the configuration, the ORM, the job registry, the module scanner — none of which a line
 * writer needs and none of which is available outside a running application; `@gauzy/config` reads the
 * process environment at import time and supplies the dialect the service quotes its one raw read with.
 * Both are doubled at the module boundary, and **the service under test is the real one**, over an
 * in-memory datastore that models the two things this domain depends on: a soft delete is a predicate
 * rather than a removal, and a transaction restores every table when the work inside it throws.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async softDelete(criteria: any): Promise<any> {
			return this.typeOrmRepository.softDelete(criteria);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}
	}

	return {
		CrudService,
		TenantAwareCrudService: CrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		JsonArrayColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		BaseEvent: class {},
		EventBus: class {},
		Payment: class Payment {},
		Integration: class Integration {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock(
	'@gauzy/config',
	() => ({
		isMySQL: () => false,
		DatabaseTypeEnum: {
			mongodb: 'mongodb',
			sqlite: 'sqlite',
			betterSqlite3: 'better-sqlite3',
			postgres: 'postgres',
			mysql: 'mysql'
		}
	})
);

import { NotFoundException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { RefundStatus } from '../payment.types';
import { Refund } from '../refund/refund.entity';
import { RefundLine } from './refund-line.entity';
import { RefundLineService } from './refund-line.service';

/**
 * Which lines a refund paid back (doc 05 §12.8, doc 10 §9.2).
 *
 * **The breakdown is rows, and the table is what makes the rule enforceable.** The refund's own amount
 * is the ceiling of the sum of its lines, the pair `(refund, order line)` is unique among live rows, and
 * a line is written in the same transaction as the refund it belongs to — so the two can never disagree
 * about what was given back. The suite pins the four things this service is deliberately strict about:
 *
 * - **a line names an order line of the caller's own organization.** An amount attributed to a line that
 *   is not there is an attribution nobody can reconcile, so the write is refused rather than stored, and
 *   the check runs inside the writing transaction;
 * - **a line is a positive magnitude.** A quantity is a positive exact decimal at the storage scale, and
 *   an amount is a positive exact decimal in the refund's currency, so zero, a negative, an exponent and
 *   a seventh fractional digit are all refused;
 * - **the ceiling is the refund's own amount**, and a line being updated is excluded from the sum it is
 *   checked against — otherwise editing a line could never succeed, because the line would be counted
 *   twice;
 * - **the breakdown of a settled refund is a record.** Once the refund has left `PENDING` the money has
 *   moved or the intention has been withdrawn, and neither is something a line may be edited to
 *   describe.
 *
 * The legacy shape is read and never written: a refund that stored its breakdown in
 * `metadata.lineRefunds[]` keeps answering with it, marked `legacy`, and no new refund writes one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const ORDER = '00000000-0000-4000-8000-000000000010';
const REFUND = 'refund-1';
const LINE_ONE = 'order-line-1';
const LINE_TWO = 'order-line-2';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	refund: Row[];
	refund_line: Row[];
	order_line: Row[];
}

/** The entity classes the service hands to its transaction manager, resolved to tables. */
const ENTITY_TABLES = new Map<unknown, keyof ITables>([
	[Refund, 'refund'],
	[RefundLine, 'refund_line']
]);

/**
 * An in-memory stand-in for the datastore the service writes through.
 *
 * A soft-deleted row stays in its table and disappears from every read, which is what TypeORM's
 * `deletedAt` predicate does and what makes `(refund, order line)` unique *among live rows*.
 *
 * @param tables The whole datastore.
 */
function datastore(tables: ITables) {
	let sequence = 0;
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});
	const live = (rows: Row[]) => rows.filter((row) => row.deletedAt == null);
	const identify = (criteria: any) => (typeof criteria === 'string' ? criteria : (criteria?.id ?? undefined));
	const tableOf = (entity: unknown): keyof ITables => {
		const table = ENTITY_TABLES.get(entity);

		if (!table) {
			throw new Error('the in-memory double was handed an entity it does not know');
		}

		return table;
	};
	const ordered = (found: Row[], order?: Record<string, 'ASC' | 'DESC'>) => {
		const columns = Object.keys(order ?? {});

		if (!columns.length) {
			return found;
		}

		return [...found].sort((left, right) => {
			for (const column of columns) {
				const a = left[column] instanceof Date ? left[column].getTime() : left[column];
				const b = right[column] instanceof Date ? right[column].getTime() : right[column];

				if (a === b) {
					continue;
				}

				return (a > b ? 1 : -1) * (order?.[column] === 'DESC' ? -1 : 1);
			}

			return 0;
		});
	};
	const snapshot = (): Record<string, Row[]> =>
		Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]));
	const save = (table: keyof ITables, entity: Row) => {
		const rows = tables[table];

		if (entity.id) {
			const index = rows.findIndex((row) => row.id === entity.id);

			if (index >= 0) {
				rows[index] = { ...rows[index], ...entity };

				return rows[index];
			}
		}

		const created = { id: `${String(table)}-${++sequence}`, createdAt: new Date(sequence), ...entity };

		rows.push(created);

		return created;
	};

	const manager: any = {
		transaction: async (run: (transactional: any) => Promise<any>) => {
			const copy = snapshot();

			try {
				return await run(manager);
			} catch (error) {
				for (const [table, rows] of Object.entries(copy)) {
					(tables as unknown as Record<string, Row[]>)[table] = rows;
				}

				throw error;
			}
		},
		create: (_entity: unknown, partial: Row) => ({ ...partial }),
		save: async (entity: unknown, rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
			const saved = list.map((row) => save(tableOf(entity), row));

			return Array.isArray(rowOrRows) ? saved : saved[0];
		},
		find: async (entity: unknown, options: any = {}) =>
			ordered(
				live(tables[tableOf(entity)]).filter((row) => matches(row, options.where)),
				options.order
			),
		findOne: async (entity: unknown, options: any = {}) =>
			live(tables[tableOf(entity)]).find((row) => matches(row, options.where)) ?? null,
		/**
		 * The one raw read this service makes: the order lines a breakdown cites, read by name inside the
		 * writing transaction. The conditions the service states are applied — the ids, the soft-delete
		 * filter and the caller's own tenant and organization.
		 */
		createQueryBuilder: () => {
			const conditions: Array<{ sql: string; params: Row }> = [];
			const builder: any = {
				select: () => builder,
				from: () => builder,
				where: (sql: string, params: Row = {}) => {
					conditions.push({ sql, params });

					return builder;
				},
				andWhere: (sql: string, params: Row = {}) => {
					conditions.push({ sql, params });

					return builder;
				},
				getRawMany: async () => {
					const parameters = conditions.reduce<Row>((all, one) => ({ ...all, ...one.params }), {});

					return live(tables.order_line)
						.filter((line) => (parameters.orderLineIds ?? []).includes(line.id))
						.filter((line) => !parameters.tenantId || line.tenantId === parameters.tenantId)
						.filter(
							(line) => !parameters.organizationId || line.organizationId === parameters.organizationId
						)
						.map((line) => ({ id: line.id }));
				}
			};

			return builder;
		}
	};

	const repository = (table: keyof ITables) => ({
		manager,
		metadata: { tableName: table, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) =>
			ordered(
				live(tables[table]).filter((row) => matches(row, options.where)),
				options.order
			),
		findOne: async (options: any = {}) => live(tables[table]).find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: Row) => live(tables[table]).find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = live(tables[table]).filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => live(tables[table]).length,
		create: (partial: Row) => ({ ...partial }),
		save: async (entity: Row) => save(table, entity),
		update: async (criteria: any, partial: Row) => {
			const index = tables[table].findIndex((row) => row.id === identify(criteria));

			if (index >= 0) {
				Object.assign(tables[table][index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		softDelete: async (criteria: any) => {
			const index = tables[table].findIndex((row) => row.id === identify(criteria));

			if (index >= 0) {
				tables[table][index].deletedAt = new Date();
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const index = tables[table].findIndex((row) => row.id === identify(criteria));

			if (index >= 0) {
				tables[table].splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	});

	return { repository, manager };
}

/** One `refund` row, as the service reads it. */
const refundRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	paymentId: 'payment-1',
	amount: '100',
	currency: 'USD',
	status: RefundStatus.PENDING,
	...overrides
});

/** One `refund_line` row, as the service reads it. */
const lineRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	refundId: REFUND,
	orderLineId: LINE_ONE,
	quantity: '1',
	amount: '60',
	currency: 'USD',
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

/**
 * Builds the line service over one in-memory datastore.
 *
 * @param options The rows the fixture starts with.
 */
function lineFixture(options: { refunds?: Row[]; lines?: Row[]; orderLines?: Row[] } = {}) {
	const tables: ITables = {
		refund: options.refunds ?? [refundRow(REFUND)],
		refund_line: options.lines ?? [],
		order_line: options.orderLines ?? [
			{ id: LINE_ONE, tenantId: TENANT, organizationId: ORG },
			{ id: LINE_TWO, tenantId: TENANT, organizationId: ORG }
		]
	};
	const store = datastore(tables);
	const service = new RefundLineService(store.repository('refund_line') as never, {} as never);

	return {
		service,
		tables,
		manager: store.manager,
		refund: (id: string = REFUND) => tables.refund.find((row) => row.id === id),
		linesOf: (refundId: string = REFUND) => tables.refund_line.filter((row) => row.refundId === refundId),
		liveLinesOf: (refundId: string = REFUND) =>
			tables.refund_line.filter((row) => row.refundId === refundId && row.deletedAt == null)
	};
}

/** A line to record, so a case states only what it is about. */
const lineInput = (overrides: Row = {}) => ({
	refundId: REFUND,
	orderLineId: LINE_ONE,
	quantity: '1',
	amount: '60',
	...overrides
});

describe('RefundLineService — the breakdown is rows (doc 05 §12.8)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes one row per line, in the refund’s id, currency and scope', async () => {
		const fixture = lineFixture();

		const written = await fixture.service.appendLines(fixture.manager as never, refundRow(REFUND) as never, [
			{ orderLineId: LINE_ONE, quantity: '1', amount: '60' },
			{ orderLineId: LINE_TWO, quantity: '2', amount: '40' }
		] as never);

		expect(written).toHaveLength(2);
		expect(fixture.linesOf()).toEqual([
			expect.objectContaining({
				refundId: REFUND,
				orderLineId: LINE_ONE,
				quantity: '1',
				amount: '60',
				currency: 'USD',
				tenantId: TENANT,
				organizationId: ORG
			}),
			expect.objectContaining({ orderLineId: LINE_TWO, quantity: '2', amount: '40' })
		]);
	});

	it('writes nothing, and answers nothing, when there is no breakdown to write', async () => {
		const fixture = lineFixture();

		expect(await fixture.service.appendLines(fixture.manager as never, refundRow(REFUND) as never, [] as never)).toEqual(
			[]
		);
		expect(fixture.tables.refund_line).toEqual([]);
	});

	it('accepts a breakdown that accounts for the refund exactly and refuses one that passes it', async () => {
		const exact = lineFixture();

		await exact.service.appendLines(exact.manager as never, refundRow(REFUND) as never, [
			{ orderLineId: LINE_ONE, quantity: '1', amount: '60' },
			{ orderLineId: LINE_TWO, quantity: '4', amount: '40' }
		] as never);

		expect(exact.linesOf()).toHaveLength(2);

		const over = lineFixture();

		await expect(
			over.service.appendLines(over.manager as never, refundRow(REFUND) as never, [
				{ orderLineId: LINE_ONE, quantity: '1', amount: '60' },
				{ orderLineId: LINE_TWO, quantity: '4', amount: '40.01' }
			] as never)
		).rejects.toThrow(/REFUND_LINE_OVER_REFUND/);
		expect(over.tables.refund_line).toEqual([]);
	});

	it('refuses a line that cites an order line this organization does not have', async () => {
		// An amount attributed to a line that is not there is an attribution nobody can reconcile, so the
		// write is refused rather than stored.
		const fixture = lineFixture();

		await expect(
			fixture.service.appendLines(fixture.manager as never, refundRow(REFUND) as never, [
				{ orderLineId: 'no-such-line', quantity: '1', amount: '60' }
			] as never)
		).rejects.toThrow(/REFUND_LINE_ORDER_LINE_NOT_FOUND/);
		expect(fixture.tables.refund_line).toEqual([]);
	});

	it('refuses a line that cites another organization’s order line', async () => {
		// The order aggregate is a peer package, so the check reads its table scoped by the caller's own
		// tenant and organization: an amount attributed to a line of another organization is refused rather
		// than stored.
		const fixture = lineFixture({
			orderLines: [{ id: LINE_ONE, tenantId: TENANT, organizationId: OTHER_ORG }]
		});

		await expect(
			fixture.service.appendLines(fixture.manager as never, refundRow(REFUND) as never, [
				{ orderLineId: LINE_ONE, quantity: '1', amount: '60' }
			] as never)
		).rejects.toThrow(/REFUND_LINE_ORDER_LINE_NOT_FOUND/);
		expect(fixture.tables.refund_line).toEqual([]);
	});

	it('fails closed when the caller has no tenant and organization to attribute the line to', async () => {
		const fixture = lineFixture();

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);

		await expect(
			fixture.service.appendLines(fixture.manager as never, refundRow(REFUND) as never, [
				{ orderLineId: LINE_ONE, quantity: '1', amount: '60' }
			] as never)
		).rejects.toThrow(/REFUND_LINE_SCOPE_REQUIRED/);
		expect(fixture.tables.refund_line).toEqual([]);
	});
});

describe('RefundLineService — what a line may be (doc 05 §12.8)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([['1'], ['1.5'], ['0.000001'], ['2'], ['000001']])(
		'accepts the quantity %s as a positive exact decimal',
		async (quantity) => {
			const fixture = lineFixture();
			const refund = refundRow(REFUND, { amount: '1000000' });

			const written = await fixture.service.appendLines(fixture.manager as never, refund as never, [
				{ orderLineId: LINE_ONE, quantity, amount: '60' }
			] as never);

			expect(written[0].quantity).toBe(quantity);
		}
	);

	it.each([
		['zero', '0'],
		['zero at the storage scale', '0.000000'],
		['a negative magnitude', '-1'],
		['an exponent', '1e3'],
		['a seventh fractional digit', '1.0000001'],
		['fifteen integer digits', '123456789012345'],
		['nothing at all', ''],
		['a word', 'one']
	])('refuses %s as a line quantity', async (_label, quantity) => {
		// A quantity column holds a positive magnitude at the storage scale: `numeric(20,6)`, so a seventh
		// fractional digit cannot be stored and is refused rather than rounded.
		const fixture = lineFixture();

		await expect(
			fixture.service.appendLines(fixture.manager as never, refundRow(REFUND) as never, [
				{ orderLineId: LINE_ONE, quantity, amount: '60' }
			] as never)
		).rejects.toThrow(/REFUND_LINE_QUANTITY_INVALID/);
		expect(fixture.tables.refund_line).toEqual([]);
	});

	it.each([['0'], ['-1'], ['0.000000'], ['ten']])('refuses %s as a line amount', async (amount) => {
		// The column allows `amount >= 0` and the service is stricter, because a line of a breakdown that
		// accounts for nothing is a line nobody can explain (doc 05 §12.8, `CHK_refund_line_amount_positive`).
		const fixture = lineFixture();

		await expect(
			fixture.service.appendLines(fixture.manager as never, refundRow(REFUND) as never, [
				{ orderLineId: LINE_ONE, quantity: '1', amount }
			] as never)
		).rejects.toThrow(/REFUND_LINE_AMOUNT_INVALID/);
		expect(fixture.tables.refund_line).toEqual([]);
	});

	it('reads a line currency as the refund’s, whatever spelling it was sent in', async () => {
		const fixture = lineFixture();

		const written = await fixture.service.appendLines(fixture.manager as never, refundRow(REFUND) as never, [
			{ orderLineId: LINE_ONE, quantity: '1', amount: '60', currency: 'usd' }
		] as never);

		expect(written[0].currency).toBe('USD');
	});

	it('refuses a line whose currency is not the refund’s', async () => {
		const fixture = lineFixture();

		await expect(
			fixture.service.appendLines(fixture.manager as never, refundRow(REFUND) as never, [
				{ orderLineId: LINE_ONE, quantity: '1', amount: '60', currency: 'EUR' }
			] as never)
		).rejects.toThrow(/does not match refund currency/);
		expect(fixture.tables.refund_line).toEqual([]);
	});

	it('refuses a line that names a different refund than the one it is written for', async () => {
		// A mistake rather than a second breakdown, so it is refused instead of quietly re-pointed.
		const fixture = lineFixture();

		await expect(
			fixture.service.appendLines(fixture.manager as never, refundRow(REFUND) as never, [
				{ refundId: 'another-refund', orderLineId: LINE_ONE, quantity: '1', amount: '60' }
			] as never)
		).rejects.toThrow(/REFUND_LINE_REFUND_MISMATCH/);
		expect(fixture.tables.refund_line).toEqual([]);
	});
});

describe('RefundLineService — one line at a time (doc 05 §12.8)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records a line against a pending refund, and refuses a second one for the same order line', async () => {
		// `UQ_refund_line` claims `(refundId, orderLineId)` among live rows: two lines explaining the same
		// order line would make the register they feed count one movement twice.
		const fixture = lineFixture();

		const first = await fixture.service.createLine(lineInput() as never);

		expect(first).toMatchObject({ refundId: REFUND, orderLineId: LINE_ONE, amount: '60' });

		await expect(fixture.service.createLine(lineInput({ amount: '10' }) as never)).rejects.toThrow(
			/REFUND_LINE_EXISTS/
		);
		expect(fixture.liveLinesOf()).toHaveLength(1);
	});

	it('refuses a line against a refund that has settled', async () => {
		const settled = lineFixture({
			refunds: [
				refundRow(REFUND, { status: RefundStatus.SUCCEEDED }),
				refundRow('cancelled', { status: RefundStatus.CANCELED }),
				refundRow('failed', { status: RefundStatus.FAILED })
			]
		});

		await expect(settled.service.createLine(lineInput() as never)).rejects.toThrow(
			/REFUND_LINE_REFUND_SETTLED/
		);
		await expect(settled.service.createLine(lineInput({ refundId: 'cancelled' }) as never)).rejects.toThrow(
			/REFUND_LINE_REFUND_SETTLED/
		);
		await expect(settled.service.createLine(lineInput({ refundId: 'failed' }) as never)).rejects.toThrow(
			/REFUND_LINE_REFUND_SETTLED/
		);
		expect(settled.tables.refund_line).toEqual([]);
	});

	it('refuses a line that names no refund at all', async () => {
		const fixture = lineFixture();

		await expect(fixture.service.createLine({ orderLineId: LINE_ONE, quantity: '1', amount: '60' } as never)).rejects.toThrow(
			/REFUND_LINE_REFUND_REQUIRED/
		);
		expect(fixture.tables.refund_line).toEqual([]);
	});

	it('reports an unknown refund as missing rather than writing a line against nothing', async () => {
		const fixture = lineFixture();

		await expect(fixture.service.createLine(lineInput({ refundId: 'nope' }) as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(fixture.tables.refund_line).toEqual([]);
	});

	it('changes what a line records, and does not count the line against the ceiling twice', async () => {
		// The refund is 100.00 and the breakdown is 60.00 + 40.00; editing the first line to 60.00 again —
		// or to any value that keeps the sum inside the refund — must be possible, which it is only because
		// the line being updated is excluded from the sum it is checked against.
		const fixture = lineFixture({
			lines: [
				lineRow('l1', { orderLineId: LINE_ONE, quantity: '1', amount: '60' }),
				lineRow('l2', { orderLineId: LINE_TWO, quantity: '4', amount: '40' })
			]
		});

		const unchanged = await fixture.service.updateLine('l1', { amount: '60' } as never);

		expect(unchanged).toMatchObject({ amount: '60' });

		const changed = await fixture.service.updateLine('l1', { quantity: '1.5', amount: '50' } as never);

		expect(changed).toMatchObject({ quantity: '1.5', amount: '50' });
		expect(await fixture.service.sumLinesForRefund(REFUND)).toBe('90');

		await expect(fixture.service.updateLine('l1', { amount: '60.01' } as never)).rejects.toThrow(
			/REFUND_LINE_OVER_REFUND/
		);
		expect(fixture.linesOf().find((row) => row.id === 'l1')).toMatchObject({ amount: '50' });
	});

	it('refuses to move a line to another refund or to another order line', async () => {
		// A different order line is a different line: it is added rather than rewritten.
		const fixture = lineFixture({ lines: [lineRow('l1', { amount: '60' })] });

		await expect(fixture.service.updateLine('l1', { refundId: 'another-refund' } as never)).rejects.toThrow(
			/REFUND_LINE_REFUND_IMMUTABLE/
		);
		await expect(fixture.service.updateLine('l1', { orderLineId: LINE_TWO } as never)).rejects.toThrow(
			/REFUND_LINE_ORDER_LINE_IMMUTABLE/
		);
		expect(fixture.linesOf().find((row) => row.id === 'l1')).toMatchObject({
			refundId: REFUND,
			orderLineId: LINE_ONE
		});
	});

	it('refuses to change a line of a refund that has settled', async () => {
		const fixture = lineFixture({
			refunds: [refundRow(REFUND, { status: RefundStatus.SUCCEEDED })],
			lines: [lineRow('l1', { amount: '60' })]
		});

		await expect(fixture.service.updateLine('l1', { amount: '10' } as never)).rejects.toThrow(
			/REFUND_LINE_REFUND_SETTLED/
		);
		await expect(fixture.service.removeLine('l1')).rejects.toThrow(/REFUND_LINE_REFUND_SETTLED/);
		expect(fixture.linesOf().find((row) => row.id === 'l1')).toMatchObject({ amount: '60' });
		expect(fixture.linesOf().find((row) => row.id === 'l1').deletedAt).toBeUndefined();
	});

	it('removes a line softly, so the pair it claimed can be recorded again', async () => {
		// The uniqueness of `(refund, order line)` is a predicate on `deletedAt`, so a removed line does not
		// block the explanation that replaces it — and the removed row itself stays readable.
		const fixture = lineFixture({ lines: [lineRow('l1', { amount: '60' })] });

		const removed = await fixture.service.removeLine('l1');

		expect(removed).toMatchObject({ id: 'l1', amount: '60' });
		expect(fixture.tables.refund_line).toHaveLength(1);
		expect(fixture.tables.refund_line[0].deletedAt).toBeInstanceOf(Date);
		expect(fixture.liveLinesOf()).toEqual([]);
		// The removed line no longer accounts for anything, so what it held is available again.
		expect(await fixture.service.sumLinesForRefund(REFUND)).toBe('0');

		const again = await fixture.service.createLine(lineInput({ amount: '100' }) as never);

		expect(again).toMatchObject({ orderLineId: LINE_ONE, amount: '100' });
		expect(fixture.liveLinesOf()).toHaveLength(1);
	});

	it('reports an unknown line, and another organization’s line, as missing', async () => {
		const fixture = lineFixture({ lines: [lineRow('theirs', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.findLineOrFail('nope')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findLineOrFail('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.removeLine('theirs')).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.tables.refund_line[0].deletedAt).toBeUndefined();
	});
});

describe('RefundLineService — reading the breakdown (doc 05 §12.8, doc 10 §9.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('answers the rows of a refund in the order they were recorded', async () => {
		const fixture = lineFixture({
			lines: [
				lineRow('l2', { orderLineId: LINE_TWO, amount: '40', createdAt: new Date('2026-02-01T00:00:00.000Z') }),
				lineRow('l1', { orderLineId: LINE_ONE, amount: '60', createdAt: new Date('2026-01-01T00:00:00.000Z') })
			]
		});

		const lines = await fixture.service.findLines(REFUND);

		expect(lines.map((line) => line.id)).toEqual(['l1', 'l2']);
		expect(lines.map((line) => line.legacy)).toEqual([false, false]);
	});

	it('answers the per-line array of a refund written before the table existed, marked legacy', async () => {
		// The array is a **read path and only a read path**: the refunds that stored their lines that way keep
		// answering with them, and every refund written from here on writes rows instead.
		const fixture = lineFixture({
			refunds: [
				refundRow('legacy', {
					amount: '100',
					metadata: {
						lineRefunds: [
							{ orderLineId: LINE_ONE, quantity: '1', amount: '60' },
							{ orderLineId: LINE_TWO, quantity: '4', amount: '40' },
							{ quantity: '1', amount: '1' },
							'not an object'
						]
					}
				})
			]
		});

		const lines = await fixture.service.findLines('legacy');

		expect(lines).toEqual([
			expect.objectContaining({ refundId: 'legacy', orderLineId: LINE_ONE, quantity: '1', amount: '60', legacy: true }),
			expect.objectContaining({ orderLineId: LINE_TWO, quantity: '4', amount: '40', legacy: true })
		]);
		expect(await fixture.service.sumLinesForRefund('legacy')).toBe('100');
		expect(fixture.tables.refund_line).toEqual([]);
	});

	it('answers no lines at all for a refund that recorded neither', async () => {
		const fixture = lineFixture();

		expect(await fixture.service.findLines(REFUND)).toEqual([]);
		expect(await fixture.service.sumLinesForRefund(REFUND)).toBe('0');
	});

	it('reports an unknown refund as missing rather than answering with an empty breakdown', async () => {
		const fixture = lineFixture();

		await expect(fixture.service.findLines('nope')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.sumLinesForRefund('nope')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('sums the lines exactly, without binary floating point drift', async () => {
		const fixture = lineFixture({
			refunds: [refundRow(REFUND, { amount: '1' })],
			lines: [
				lineRow('l1', { orderLineId: LINE_ONE, quantity: '1', amount: '0.1' }),
				lineRow('l2', { orderLineId: LINE_TWO, quantity: '1', amount: '0.2' })
			]
		});

		expect(await fixture.service.sumLinesForRefund(REFUND)).toBe('0.3');
		expect(0.1 + 0.2).not.toBe(0.3);
	});

	it('paginates the lines of the caller’s organization, and only those', async () => {
		const fixture = lineFixture({
			lines: [
				lineRow('mine', { orderLineId: LINE_ONE }),
				lineRow('also-mine', { orderLineId: LINE_TWO }),
				lineRow('theirs', { orderLineId: LINE_ONE, organizationId: OTHER_ORG })
			]
		});

		const page = await fixture.service.findLinesPage();

		expect(page.total).toBe(2);
		expect(page.items.map((line) => line.id).sort()).toEqual(['also-mine', 'mine']);
	});
});
