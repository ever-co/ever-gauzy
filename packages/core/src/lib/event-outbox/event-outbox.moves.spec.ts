import { NotFoundException } from '@nestjs/common';
import { EventOutboxStatus, ID } from '@gauzy/contracts';

/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service.
 *
 * `crud.service.ts` reaches the entity barrel one line after it is entered, and that barrel reaches
 * `core/crud` back through the subscribers it loads — so a graph entered through the service finds
 * `CrudService` undefined while `tenant-aware-crud.service.ts` extends it, and the suite fails to
 * LOAD with `Class extends value undefined` rather than failing an assertion. Loading the entity
 * barrel first lets the crud module finish before anything extends what it declares.
 */
import '../core/entities/internal';

import { RequestContext } from '../core/context/request-context';
import { EventDelivery } from './event-delivery.entity';
import { EventOutbox } from './event-outbox.entity';
import { EVENT_DELIVERY_ACTIONS } from './event-delivery.publisher';
import { EventOutboxService } from './event-outbox.service';
import { TypeOrmEventDeliveryRepository } from './repository/type-orm-event-delivery.repository';
import { TypeOrmEventOutboxRepository } from './repository/type-orm-event-outbox.repository';

/**
 * The operator's half of the reliability kernel: what the two routes and the two GraphQL mutations
 * reach.
 *
 * The delivered service suite asserts the dispatch path — the append, the lease, the retry ladder and
 * the per-consumer record — against its own table stand-ins. This suite asserts the other half, which
 * arrived with the REST and GraphQL surfaces and is the half a caller can aim at:
 *
 * - **the scope.** A diagnostic read and a move are both limited to the caller's own rows, so the
 *   surfaces cannot become a way to read or to move another tenant's delivery ledger. The
 *   organization is read the way the platform reads a shared row: the caller's own, or the absence of
 *   one.
 * - **the two moves.** A replay resets the record the way a fresh one is written, so the retry scan
 *   re-drives it; a dead-letter stops it with the operator's reason on the record's own error column.
 *   Each answers the record as the store holds it afterwards.
 * - **the announcement.** Every move is published from the service, so the REST route and the GraphQL
 *   mutation announce one fact and a subscriber cannot tell which protocol moved the record. A
 *   process with no subscription surface still writes the move and announces nothing.
 */

type Row = Record<string, any>;

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000009';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const OTHER_ORGANIZATION = '00000000-0000-4000-8000-000000000003';
const EVENT_ID = '00000000-0000-4000-8000-0000000000e1';
const DELIVERY = '00000000-0000-4000-8000-000000000020';
const FOREIGN_DELIVERY = '00000000-0000-4000-8000-000000000021';
const TENANT_WIDE_DELIVERY = '00000000-0000-4000-8000-000000000022';
const OUTBOX_ROW = '00000000-0000-4000-8000-000000000010';
const FOREIGN_ROW = '00000000-0000-4000-8000-000000000011';

/** One column's criterion, including the operator TypeORM builds for `IsNull`. */
function valueMatches(value: unknown, criterion: unknown): boolean {
	const operator = criterion as { _type?: string; _value?: unknown };

	if (operator && typeof operator === 'object' && operator._type === 'isNull') {
		return (value ?? null) === null;
	}

	return (value ?? null) === (criterion ?? null);
}

/** Whether a row satisfies every column of one criterion. */
function rowMatches(row: Row, criterion: Row = {}): boolean {
	return Object.entries(criterion).every(([column, condition]) => valueMatches(row[column], condition));
}

/** The rows of one table, as the reads and the statements the service issues see them. */
class Table {
	readonly rows: Row[] = [];

	constructor(private readonly rows_: Row[]) {
		this.rows.push(...rows_.map((row) => ({ ...row })));
	}

	/** The rows matching one criterion or an OR of criteria, as `where: [...]` means. */
	private matching(where: Row | Row[] | undefined): Row[] {
		if (!where) {
			return [...this.rows];
		}

		return this.rows.filter((row) =>
			Array.isArray(where) ? where.some((criterion) => rowMatches(row, criterion)) : rowMatches(row, where)
		);
	}

	/** Orders rows by the service's `order` object, key by key. */
	private ordered(rows: Row[], order: Row = {}): Row[] {
		const keys = Object.entries(order);

		return [...rows].sort((left, right) => {
			for (const [column, direction] of keys) {
				const a = left[column] ?? null;
				const b = right[column] ?? null;

				if (a === b) {
					continue;
				}

				// An absent value is the largest value, which is the rule the connection states as well.
				if (a === null || b === null) {
					return (a === null ? 1 : -1) * (direction === 'DESC' ? -1 : 1);
				}

				const compared = a > b ? 1 : -1;

				return direction === 'DESC' ? -compared : compared;
			}

			return 0;
		});
	}

	async find(options: { where?: Row | Row[]; order?: Row } = {}): Promise<Row[]> {
		return this.ordered(this.matching(options.where), options.order ?? {});
	}

	async findOne(options: { where?: Row | Row[] } = {}): Promise<Row | null> {
		return this.matching(options.where)[0] ?? null;
	}

	async update(criteria: Row, values: Row): Promise<{ affected: number }> {
		const matched = this.matching(criteria);

		for (const row of matched) {
			Object.assign(row, values);
		}

		return { affected: matched.length };
	}
}

/** The rows the two tables hold: the caller's, another tenant's, and one that names no organization. */
const DELIVERY_ROWS: Row[] = [
	{
		id: DELIVERY,
		eventId: EVENT_ID,
		consumerKey: 'subscriber:notification.order-confirmation',
		status: EventOutboxStatus.FAILED,
		attemptCount: 3,
		deliveredAt: null,
		lastError: 'the mail relay refused the message',
		partitionKey: 'order:1',
		sequence: 3,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		createdAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: TENANT_WIDE_DELIVERY,
		eventId: EVENT_ID,
		consumerKey: 'job:search-index',
		status: EventOutboxStatus.DEAD,
		attemptCount: 8,
		deliveredAt: new Date('2026-03-01T11:00:00.000Z'),
		lastError: 'the index refused the document',
		partitionKey: 'order:1',
		sequence: 3,
		tenantId: TENANT,
		// An event appended outside a request names no organization, and it belongs to every
		// organization of its tenant rather than to none.
		organizationId: null,
		createdAt: new Date('2026-03-01T09:00:00.000Z')
	},
	{
		id: FOREIGN_DELIVERY,
		eventId: '00000000-0000-4000-8000-0000000000e9',
		consumerKey: 'subscriber:notification.order-confirmation',
		status: EventOutboxStatus.DEAD,
		attemptCount: 4,
		deliveredAt: null,
		lastError: 'another tenant’s consumer',
		partitionKey: 'order:2',
		sequence: 1,
		tenantId: OTHER_TENANT,
		organizationId: OTHER_ORGANIZATION,
		createdAt: new Date('2026-03-02T10:00:00.000Z')
	},
	{
		id: '00000000-0000-4000-8000-000000000023',
		eventId: EVENT_ID,
		consumerKey: 'webhook:00000000-0000-4000-8000-0000000000f1',
		status: EventOutboxStatus.PUBLISHED,
		attemptCount: 1,
		deliveredAt: new Date('2026-03-01T10:05:00.000Z'),
		lastError: null,
		partitionKey: 'order:1',
		sequence: 3,
		tenantId: TENANT,
		organizationId: OTHER_ORGANIZATION,
		createdAt: new Date('2026-03-01T10:04:00.000Z')
	}
];

const OUTBOX_ROWS: Row[] = [
	{
		id: OUTBOX_ROW,
		eventId: EVENT_ID,
		eventName: 'order.placed',
		aggregateType: 'order',
		aggregateId: '00000000-0000-4000-8000-0000000000a1',
		payload: {},
		status: EventOutboxStatus.PENDING,
		attemptCount: 1,
		availableAt: new Date('2026-03-01T12:00:00.000Z'),
		partitionKey: 'order:1',
		sequence: 3,
		tenantId: TENANT,
		organizationId: ORGANIZATION
	},
	{
		id: '00000000-0000-4000-8000-000000000012',
		eventId: '00000000-0000-4000-8000-0000000000e2',
		eventName: 'payment.captured',
		aggregateType: 'payment',
		aggregateId: '00000000-0000-4000-8000-0000000000a2',
		payload: {},
		status: EventOutboxStatus.DEAD,
		attemptCount: 10,
		availableAt: new Date('2026-03-01T10:00:00.000Z'),
		partitionKey: 'payment:1',
		sequence: 1,
		tenantId: TENANT,
		organizationId: null
	},
	{
		id: FOREIGN_ROW,
		eventId: '00000000-0000-4000-8000-0000000000e9',
		eventName: 'order.placed',
		aggregateType: 'order',
		aggregateId: '00000000-0000-4000-8000-0000000000a9',
		payload: {},
		status: EventOutboxStatus.PENDING,
		attemptCount: 0,
		availableAt: new Date('2026-03-01T08:00:00.000Z'),
		partitionKey: 'order:9',
		sequence: 1,
		tenantId: OTHER_TENANT,
		organizationId: OTHER_ORGANIZATION
	}
];

/**
 * The service over two tables, a scripted publisher, and a request that belongs to one tenant.
 *
 * @param options The tenant and organization the caller acts in, and whether a fan-out is present.
 * @returns The service, its two tables and the publisher.
 */
function surfaces(options: { tenantId?: string; organizationId?: string; publisher?: boolean } = {}) {
	const outboxTable = new Table(OUTBOX_ROWS);
	const deliveryTable = new Table(DELIVERY_ROWS);
	const publisher = { deliveryChanged: jest.fn().mockResolvedValue(true) };

	const service = new EventOutboxService(
		outboxTable as unknown as TypeOrmEventOutboxRepository,
		outboxTable as never,
		deliveryTable as unknown as TypeOrmEventDeliveryRepository,
		deliveryTable as never,
		options.publisher === false ? undefined : (publisher as never)
	);

	const tenant = jest
		.spyOn(RequestContext, 'currentTenantId')
		.mockReturnValue((options.tenantId ?? TENANT) as ID);
	const organization = jest
		.spyOn(RequestContext, 'currentOrganizationId')
		.mockReturnValue((options.organizationId ?? ORGANIZATION) as ID);

	return {
		service,
		outboxTable,
		deliveryTable,
		publisher,
		restore: () => {
			tenant.mockRestore();
			organization.mockRestore();
		}
	};
}

describe('EventOutboxService — a diagnostic read is the caller’s own rows', () => {
	it('answers the outbox rows of the caller’s tenant, and a tenant-wide row beside them', async () => {
		const { service, restore } = surfaces();

		try {
			const rows = await service.listOutboxRows();

			// The foreign row is absent, the caller's two are present: one names the caller's organization
			// and one names none, and the second is the tenant-wide fact rather than nobody's.
			expect(rows.map((row) => row.id)).toEqual(['00000000-0000-4000-8000-000000000012', OUTBOX_ROW]);
		} finally {
			restore();
		}
	});

	it('answers the rows whose turn comes first, at the head', async () => {
		const { service, restore } = surfaces();

		try {
			const rows = await service.listOutboxRows();

			expect(rows.map((row) => row.availableAt.toISOString())).toEqual([
				'2026-03-01T10:00:00.000Z',
				'2026-03-01T12:00:00.000Z'
			]);
		} finally {
			restore();
		}
	});

	it('narrows by status, event name and aggregate', async () => {
		const { service, restore } = surfaces();

		try {
			expect((await service.listOutboxRows({ status: EventOutboxStatus.DEAD })).map((row) => row.id)).toEqual([
				'00000000-0000-4000-8000-000000000012'
			]);
			expect((await service.listOutboxRows({ eventName: 'order.placed' })).map((row) => row.id)).toEqual([
				OUTBOX_ROW
			]);
			expect(
				(await service.listOutboxRows({ aggregateId: '00000000-0000-4000-8000-0000000000a2' })).map(
					(row) => row.id
				)
			).toEqual(['00000000-0000-4000-8000-000000000012']);
			// A member the caller did not state does not narrow, and a member it did state that matches
			// nothing answers nothing rather than everything.
			expect(await service.listOutboxRows({ eventName: 'order.cancelled' })).toEqual([]);
		} finally {
			restore();
		}
	});

	it('answers the delivery records of the caller’s tenant, newest first', async () => {
		const { service, restore } = surfaces();

		try {
			const rows = await service.listDeliveryRows();

			expect(rows.map((row) => row.id)).toEqual([DELIVERY, TENANT_WIDE_DELIVERY]);
		} finally {
			restore();
		}
	});

	it('narrows the delivery ledger by status, consumer key and event', async () => {
		const { service, restore } = surfaces();

		try {
			expect((await service.listDeliveryRows({ status: EventOutboxStatus.DEAD })).map((row) => row.id)).toEqual([
				TENANT_WIDE_DELIVERY
			]);
			expect((await service.listDeliveryRows({ consumerKey: 'job:search-index' })).map((row) => row.id)).toEqual([
				TENANT_WIDE_DELIVERY
			]);
			expect((await service.listDeliveryRows({ eventId: EVENT_ID })).map((row) => row.id)).toEqual([
				DELIVERY,
				TENANT_WIDE_DELIVERY
			]);
		} finally {
			restore();
		}
	});

	it('answers one row or one record, and nothing for another tenant’s', async () => {
		const { service, restore } = surfaces();

		try {
			expect(await service.findOutboxRow(OUTBOX_ROW)).not.toBeNull();
			expect(await service.findOutboxRow(FOREIGN_ROW)).toBeNull();
			expect(await service.findDeliveryRow(DELIVERY)).not.toBeNull();
			expect(await service.findDeliveryRow(FOREIGN_DELIVERY)).toBeNull();
		} finally {
			restore();
		}
	});
});

describe('EventOutboxService — the two operator moves', () => {
	it('replays a record: the budget, the error and the acknowledgement are reset', async () => {
		const { service, deliveryTable, publisher, restore } = surfaces();

		try {
			const replayed = await service.replayDelivery(DELIVERY);

			expect(replayed.status).toBe(EventOutboxStatus.PENDING);
			expect(replayed.attemptCount).toBe(0);
			expect(replayed.lastError).toBeNull();
			expect(replayed.deliveredAt).toBeNull();
			// The answer is the row the store now holds, and the move is announced once.
			expect(deliveryTable.rows.find((row) => row.id === DELIVERY)?.status).toBe(EventOutboxStatus.PENDING);
			expect(publisher.deliveryChanged).toHaveBeenCalledWith(replayed, EVENT_DELIVERY_ACTIONS.REPLAYED);
		} finally {
			restore();
		}
	});

	it('dead-letters a record with the operator’s reason on its own error column', async () => {
		const { service, deliveryTable, publisher, restore } = surfaces();

		try {
			const dead = await service.deadLetterDelivery(DELIVERY, 'stopped by hand');

			expect(dead.status).toBe(EventOutboxStatus.DEAD);
			expect(dead.lastError).toBe('stopped by hand');
			expect(deliveryTable.rows.find((row) => row.id === DELIVERY)?.lastError).toBe('stopped by hand');
			expect(publisher.deliveryChanged).toHaveBeenCalledWith(dead, EVENT_DELIVERY_ACTIONS.MARKED_DEAD);
		} finally {
			restore();
		}
	});

	it('answers a record that is not the caller’s as a miss, and writes nothing', async () => {
		const { service, deliveryTable, publisher, restore } = surfaces();

		try {
			for (const move of [
				() => service.replayDelivery(FOREIGN_DELIVERY),
				() => service.deadLetterDelivery(FOREIGN_DELIVERY, 'stopped by hand')
			]) {
				const error = await move().catch((thrown) => thrown);

				expect(error).toBeInstanceOf(NotFoundException);
				expect((error as Error).message).toContain('RESOURCE_NOT_FOUND');
			}

			// The foreign record is exactly as it was, and nothing was announced about it.
			expect(deliveryTable.rows.find((row) => row.id === FOREIGN_DELIVERY)?.status).toBe(EventOutboxStatus.DEAD);
			expect(publisher.deliveryChanged).not.toHaveBeenCalled();
		} finally {
			restore();
		}
	});

	it('answers a record of another organization of the tenant as a miss, because it is not a tenant-wide one', async () => {
		const { service, restore } = surfaces();

		try {
			const error = await service
				.replayDelivery('00000000-0000-4000-8000-000000000023')
				.catch((thrown) => thrown);

			expect(error).toBeInstanceOf(NotFoundException);
		} finally {
			restore();
		}
	});

	it('answers a record of another tenant as a miss even when the id is known', async () => {
		const { service, restore } = surfaces({ tenantId: OTHER_TENANT, organizationId: OTHER_ORGANIZATION });

		try {
			// The caller's own tenant sees its own record and not the first tenant's.
			expect((await service.listDeliveryRows()).map((row) => row.id)).toEqual([FOREIGN_DELIVERY]);
			expect(await service.findDeliveryRow(DELIVERY)).toBeNull();
		} finally {
			restore();
		}
	});

	it('writes the move and announces nothing when the process hosts no subscription surface', async () => {
		const { service, deliveryTable, restore } = surfaces({ publisher: false });

		try {
			const replayed = await service.replayDelivery(DELIVERY);

			// The record is the source of truth: the move is written whatever the notification can do.
			expect(replayed.status).toBe(EventOutboxStatus.PENDING);
			expect(deliveryTable.rows.find((row) => row.id === DELIVERY)?.attemptCount).toBe(0);
		} finally {
			restore();
		}
	});

	it('reports a miss when the record vanished between the move and the answer', async () => {
		const { service, deliveryTable, restore } = surfaces();

		try {
			// The record is removed by the second read the move performs, which is what a concurrent
			// removal looks like from here: there is no row to answer with, so the miss is reported.
			let reads = 0;
			const original = deliveryTable.findOne.bind(deliveryTable);

			jest.spyOn(deliveryTable, 'findOne').mockImplementation(async (options) => {
				reads += 1;

				return reads > 1 ? null : original(options as never);
			});

			const error = await service.replayDelivery(DELIVERY).catch((thrown) => thrown);

			expect(error).toBeInstanceOf(NotFoundException);
		} finally {
			restore();
		}
	});
});
