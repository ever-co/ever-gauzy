/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service (see the ORM parity suite).
 */
import '../core/entities/internal';

import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { IEventEnvelope, IOutboxWriteInput } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import { createPlatformDataSource } from '../database/embedded-transaction-queue';
import { CreateEventOutboxTables1791000000020 } from '../database/migrations/1791000000020-CreateEventOutboxTables';
import { EventConsumerRegistry } from './event-consumer.registry';
import { EventDelivery } from './event-delivery.entity';
import {
	EventOutboxInlineDispatchWorker,
	EventOutboxInlineSweep,
	eventOutboxDispatchMode
} from './event-outbox-inline-dispatch';
import { EventOutbox } from './event-outbox.entity';
import { EventOutboxService } from './event-outbox.service';
import { TypeOrmEventDeliveryRepository } from './repository/type-orm-event-delivery.repository';
import { TypeOrmEventOutboxRepository } from './repository/type-orm-event-outbox.repository';

/**
 * An API without a queue, against a real SQLite database with the platform's transaction queue.
 *
 * Without a queue root nothing consumed the outbox queue, so the dispatch worker's after-commit wake did nothing and
 * no event was ever delivered. `EventOutboxInlineDispatchModule` runs the same worker in-process: a commit that
 * appended wakes it, a rolled-back append wakes nothing, and the passes run from the worker's own async context, so
 * on SQLite they queue behind any writer's open transaction instead of reading inside it.
 */

const TENANT = '7f0c9b0e-0000-4000-8000-000000000001';
const ORG = '7f0c9b0e-0000-4000-8000-000000000002';

const placed = (aggregateId: string): IOutboxWriteInput => ({
	name: 'order.placed',
	aggregateType: 'Order',
	aggregateId,
	data: { orderId: aggregateId },
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

describe('EventOutboxDispatchWorker in-process (no queue) on SQLite', () => {
	let dataSource: DataSource;
	let service: EventOutboxService;
	let worker: EventOutboxInlineDispatchWorker;
	let registry: EventConsumerRegistry;
	let received: IEventEnvelope[];
	let claims: number;

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

		service = new EventOutboxService(
			new TypeOrmEventOutboxRepository(dataSource.getRepository(EventOutbox)),
			{} as never,
			new TypeOrmEventDeliveryRepository(dataSource.getRepository(EventDelivery)),
			{} as never
		);
		registry = new EventConsumerRegistry(service);
		received = [];
		registry.register({
			key: 'inline-sqlite.probe',
			events: ['order.placed'],
			handle: async (event: IEventEnvelope) => {
				received.push(event);
			}
		});

		claims = 0;
		const claimBatch = service.claimBatch.bind(service);
		jest.spyOn(service, 'claimBatch').mockImplementation(async (policy) => {
			claims += 1;
			return claimBatch(policy);
		});

		// As `EventOutboxInlineDispatchModule` provides it: run in-process, listening to the commits.
		worker = new EventOutboxInlineDispatchWorker(service, registry);
		worker.onModuleInit();
	});

	afterEach(async () => {
		// Waits for the passes in progress, so no write reaches a destroyed database.
		await worker.onModuleDestroy();
		await dataSource.destroy();
		jest.restoreAllMocks();
	});

	it('delivers an event once its writer commits, and not a moment before', async () => {
		await dataSource.manager.transaction(async (manager) => {
			await manager.query(`INSERT INTO "outbox_probe_state" ("id") VALUES (?)`, ['kept']);
			await service.append(manager, placed('order-kept'));
			// The writer is still open: nothing has been woken.
			await new Promise((resolve) => setImmediate(resolve));
			expect(claims).toBe(0);
		});

		await until(() => received.length >= 1, 'the consumer to receive the committed event');
		await worker.onModuleDestroy();

		expect(received.map((event) => event.aggregate.id)).toEqual(['order-kept']);
		expect(await dataSource.query(`SELECT "status" FROM "event_outbox"`)).toEqual([{ status: 'PUBLISHED' }]);
	});

	it('hands nothing to a consumer for a transaction that rolls back', async () => {
		const refused = dataSource.manager.transaction(async (manager) => {
			await manager.query(`INSERT INTO "outbox_probe_state" ("id") VALUES (?)`, ['refused']);
			await service.append(manager, placed('order-refused'));
			throw new Error('the state change was refused');
		});
		await expect(refused).rejects.toThrow('the state change was refused');

		// A later commit wakes the worker: it delivers that event, and the refused one never existed.
		await dataSource.manager.transaction((manager) => service.append(manager, placed('order-later')));
		await until(() => received.length >= 1, 'the consumer to receive the later event');
		await worker.onModuleDestroy();

		expect(received.map((event) => event.aggregate.id)).toEqual(['order-later']);
	});

	it('is woken by the sweep for what no commit in this process announced', async () => {
		await dataSource.manager.transaction((manager) => service.append(manager, placed('order-elsewhere')));
		await until(() => received.length >= 1, 'the first delivery');
		await worker.onModuleDestroy();
		received = [];
		// As if another process had appended it: due again, and no commit here announces it.
		await dataSource.query(`UPDATE "event_outbox" SET "status" = 'PENDING', "availableAt" = ?`, [
			new Date(Date.now() - 1000).toISOString()
		]);
		await dataSource.query(`DELETE FROM "event_delivery"`);

		// Nest builds the in-process worker (its constructor inherited from the queue worker) and the sweep.
		const moduleRef = await Test.createTestingModule({
			providers: [
				{ provide: EventOutboxService, useValue: service },
				{ provide: EventConsumerRegistry, useValue: registry },
				EventOutboxInlineDispatchWorker,
				EventOutboxInlineSweep
			]
		}).compile();
		const app = moduleRef.createNestApplication({ logger: false });
		await app.init();

		// The sweep wakes the worker once at start, then on its period.
		await until(() => received.length >= 1, 'the sweep to deliver the waiting row');
		await app.close();

		expect(received.map((event) => event.aggregate.id)).toEqual(['order-elsewhere']);
	});
});

describe('eventOutboxDispatchMode', () => {
	const NAMES = [
		'GAUZY_EVENT_OUTBOX_DISPATCH_ON_COMMIT',
		'EVENT_OUTBOX_INLINE_DISPATCH',
		'REDIS_ENABLED',
		'SCHEDULER_QUEUE_ENABLED',
		'WORKER_QUEUE_ENABLED'
	];
	let saved: Record<string, string | undefined>;

	beforeEach(() => {
		saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
		NAMES.forEach((name) => delete process.env[name]);
	});

	afterEach(() => {
		for (const name of NAMES) {
			if (saved[name] === undefined) delete process.env[name];
			else process.env[name] = saved[name];
		}
	});

	it('reads the settings the modules are wired by', () => {
		expect(eventOutboxDispatchMode()).toBe('inline');

		process.env['REDIS_ENABLED'] = 'true';
		expect(eventOutboxDispatchMode()).toBe('queue');

		process.env['GAUZY_EVENT_OUTBOX_DISPATCH_ON_COMMIT'] = 'false';
		expect(eventOutboxDispatchMode()).toBe('none');

		delete process.env['GAUZY_EVENT_OUTBOX_DISPATCH_ON_COMMIT'];
		process.env['REDIS_ENABLED'] = 'false';
		process.env['EVENT_OUTBOX_INLINE_DISPATCH'] = 'false';
		expect(eventOutboxDispatchMode()).toBe('none');
	});
});
