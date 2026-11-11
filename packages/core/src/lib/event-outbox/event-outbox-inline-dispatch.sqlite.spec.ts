/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service (see the ORM parity suite).
 */
import '../core/entities/internal';

import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IEventEnvelope, IOutboxWriteInput } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import { createPlatformDataSource } from '../database/embedded-transaction-queue';
import { CreateEventOutboxTables1791000000020 } from '../database/migrations/1791000000020-CreateEventOutboxTables';
import { EventConsumerRegistry } from './event-consumer.registry';
import { EventDelivery } from './event-delivery.entity';
import { EventOutboxAppendSignal } from './event-outbox-append.signal';
import { EventOutboxInlineDispatch } from './event-outbox-dispatch.trigger';
import { EventOutboxDispatcher } from './event-outbox-dispatcher';
import { EventOutbox } from './event-outbox.entity';
import { EventOutboxService } from './event-outbox.service';
import { TypeOrmEventDeliveryRepository } from './repository/type-orm-event-delivery.repository';
import { TypeOrmEventOutboxRepository } from './repository/type-orm-event-outbox.repository';

/**
 * The in-process drain on SQLite, against a real database with the platform's transaction queue.
 *
 * An append happens inside the writer's transaction, and the drain follows it moments later. Started from the
 * writer's async context, the drain's claim belonged to the writer's connection claim: it ran inside that open
 * transaction, read the uncommitted row, and handed it to the consumers — a subscription event or a webhook for a
 * change the writer then rolled back. Started from the platform's own context, the claim waits in the connection
 * queue for the writer's transaction to end.
 */

const TENANT = '7f0c9b0e-0000-4000-8000-000000000001';
const ORG = '7f0c9b0e-0000-4000-8000-000000000002';
const ORDER = '7f0c9b0e-0000-4000-8000-000000000003';

const placed = (): IOutboxWriteInput => ({
	name: 'order.placed',
	aggregateType: 'Order',
	aggregateId: ORDER,
	data: { orderId: ORDER },
	tenantId: TENANT,
	organizationId: ORG
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits until a condition holds, polling; fails the case when it does not within the bound. */
async function until(condition: () => boolean, what: string, boundMs = 5_000): Promise<void> {
	for (let waited = 0; !condition(); waited += 10) {
		if (waited >= boundMs) throw new Error(`Timed out waiting for ${what}`);
		await sleep(10);
	}
}

describe('EventOutboxInlineDispatch on SQLite', () => {
	let dataSource: DataSource;
	let service: EventOutboxService;
	let inline: EventOutboxInlineDispatch;
	let received: IEventEnvelope[];
	/** Claims the drain started and finished: the sync points the cases wait on. */
	let claims: { started: number; settled: number };
	/** Every drain started, so a case and the teardown can wait for each to finish its writes. */
	let drains: Array<Promise<unknown>>;

	beforeEach(async () => {
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		dataSource = await createPlatformDataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: coreEntities,
			synchronize: false,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();

		const runner = dataSource.createQueryRunner();
		await new CreateEventOutboxTables1791000000020().sqliteUpQueryRunner(runner);
		await runner.query(`CREATE TABLE "outbox_probe_state" ("id" varchar PRIMARY KEY NOT NULL)`);
		await runner.release();

		const signal = new EventOutboxAppendSignal();
		service = new EventOutboxService(
			new TypeOrmEventOutboxRepository(dataSource.getRepository(EventOutbox)),
			{} as never,
			new TypeOrmEventDeliveryRepository(dataSource.getRepository(EventDelivery)),
			{} as never,
			undefined,
			signal
		);
		const registry = new EventConsumerRegistry(service);
		received = [];
		registry.register({
			key: 'inline-sqlite.probe',
			events: ['order.placed'],
			handle: async (event: IEventEnvelope) => {
				received.push(event);
			}
		});

		claims = { started: 0, settled: 0 };
		const claimBatch = service.claimBatch.bind(service);
		jest.spyOn(service, 'claimBatch').mockImplementation(async (policy) => {
			claims.started += 1;
			try {
				return await claimBatch(policy);
			} finally {
				claims.settled += 1;
			}
		});

		const dispatcher = new EventOutboxDispatcher(service, registry);
		const drain = dispatcher.drain.bind(dispatcher);
		drains = [];
		jest.spyOn(dispatcher, 'drain').mockImplementation((options) => {
			const running = drain(options);
			drains.push(running);
			return running;
		});

		inline = new EventOutboxInlineDispatch(signal, dispatcher);
		inline.onModuleInit();
	});

	/** Waits until every drain started so far has finished, including one a finishing drain started. */
	async function drainsFinished(): Promise<void> {
		for (let seen = -1; seen !== drains.length;) {
			seen = drains.length;
			await Promise.allSettled(drains);
		}
	}

	afterEach(async () => {
		inline.onModuleDestroy();
		// Let every drain finish its writes (marking rows published included) before the database goes away.
		await drainsFinished();
		await dataSource.destroy();
		jest.restoreAllMocks();
	});

	it('hands nothing to a consumer for a transaction that rolls back after the drain was due', async () => {
		const refused = dataSource.manager.transaction(async (manager) => {
			await manager.query(`INSERT INTO "outbox_probe_state" ("id") VALUES (?)`, ['refused']);
			await service.append(manager, placed());
			// The writer is still busy when the drain asks for its claim.
			await until(() => claims.started >= 1, 'the drain to start its claim');
			throw new Error('the state change was refused');
		});

		await expect(refused).rejects.toThrow('the state change was refused');
		// The claim that was waiting behind the writer has run, after the rollback.
		await until(() => claims.started >= 1 && claims.settled === claims.started, 'the claim to finish');

		expect(received).toEqual([]);
		expect(await dataSource.query(`SELECT COUNT(*) AS "n" FROM "event_outbox"`)).toEqual([{ n: 0 }]);
	});

	it('delivers the event once the writer commits, even when the commit comes after the drain was due', async () => {
		await dataSource.manager.transaction(async (manager) => {
			await manager.query(`INSERT INTO "outbox_probe_state" ("id") VALUES (?)`, ['kept']);
			await service.append(manager, placed());
			// The drain asks while the writer is still open; it gets the row only after the commit.
			await until(() => claims.started >= 1, 'the drain to start its claim');
		});

		await until(() => received.length >= 1, 'the consumer to receive the committed event');
		await drainsFinished();

		expect(received).toHaveLength(1);
		expect(received[0]).toMatchObject({ name: 'order.placed', aggregate: { type: 'Order', id: ORDER } });
		// The dispatch completed: the row is published, not left leased.
		expect(await dataSource.query(`SELECT "status" FROM "event_outbox"`)).toEqual([{ status: 'PUBLISHED' }]);
	});
});
