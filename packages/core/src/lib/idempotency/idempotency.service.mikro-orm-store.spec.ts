import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { HttpStatus, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom } from 'rxjs';
import type { MikroORM } from '@mikro-orm/core';
import type { DataSource } from 'typeorm';
import { IdempotencyStatus } from '@gauzy/contracts';

/**
 * An idempotency key settled, replayed and released on the real stores, under `DB_ORM=mikro-orm` exactly as
 * under TypeORM.
 *
 * **The defect.** Under `DB_ORM=mikro-orm` no key was ever settled. `settle()` writes the response through
 * `CrudService.save`, which on MikroORM loads the row and `assign()`s the payload onto it, and MikroORM's
 * assigner validates a scalar against the property's `runtimeType`. The MikroORM type `@JsonColumn` maps
 * `responseBody` with answers `compareAsType()` with `'string'` — it compares the serialised text, so that a
 * flush does not find every JSON column dirty — and a MikroORM `Type`'s `runtimeType` is its compare type unless
 * the type says otherwise. To the assigner `responseBody` was therefore a string, and every response, a JSON
 * object, was refused:
 *
 *   ValidationError: Trying to set IdempotencyKey.responseBody of type 'string' to { id: '…', … } of type 'Object'
 *
 * The interceptor logs a settle that fails ("An idempotency key could not be settled") and answers with the
 * work's own response, so the first request looked fine; the row, though, stayed `IN_PROGRESS`. The identical
 * retry was then told the work was still in flight (`409`, no `Idempotency-Replayed` header) instead of being
 * answered from the stored response, and the operator's release was refused for the same reason (`409 A request
 * with this idempotency key is still in progress`) — the three failures of `tools/scripts/commerce-flow-e2e.mjs`.
 * The fix is in `@JsonColumn`: its MikroORM type states the runtime type MikroORM's own `JsonType` states, `any`.
 *
 * **What is real here.** One better-sqlite3 database file, as the platform runs both ORMs on one database: the
 * `idempotency_key` table is created by its own TypeORM migrations, and the platform's own `IdempotencyKey`,
 * imported with every core entity under `DB_ORM=mikro-orm`, is mapped by MikroORM (configured as `@gauzy/config`
 * configures it for SQLite) and by TypeORM, whose metadata is complete in both modes. The interceptor, the
 * service and the dual-ORM CRUD path they write through are the platform's own; only the HTTP request, the
 * route's metadata and the request context are stood in for. The same flow runs on TypeORM as the control, and
 * the two ORMs must store the same bytes and replay the same body.
 */

const ENTITY_GRAPH_TIMEOUT = 15 * 60 * 1000;

const SCOPE = 'checkout.complete';
const TENANT = '5a1d7c3e-0000-4000-8000-000000000001';
const ORGANIZATION = '5a1d7c3e-0000-4000-8000-000000000002';

/** What an order route answers under MikroORM: the entity serialised, its relations as their keys. */
const ORDER = {
	id: '5a1d7c3e-0000-4000-8000-0000000000a1',
	deletedAt: null,
	createdAt: new Date('2026-03-01T10:00:00.000Z'),
	tenant: TENANT,
	organization: ORGANIZATION,
	contact: '5a1d7c3e-0000-4000-8000-0000000000c1',
	total: 42.5,
	isPaid: false,
	lines: [
		{ sku: 'A-1', quantity: 2, price: 21.25 },
		{ sku: 'B-2', quantity: 0, price: null }
	],
	note: 'naïve “quoted” ✓'
};

/** The body the client received for {@link ORDER}, which is what a replay must hand back. */
const ORDER_AS_SENT = JSON.parse(JSON.stringify(ORDER));

/** The platform modules, loaded under `DB_ORM=mikro-orm` (see `beforeAll`). */
interface IPlatform {
	IdempotencyKey: new () => object;
	IdempotencyService: typeof import('./idempotency.service').IdempotencyService;
	IdempotencyInterceptor: typeof import('./idempotency.interceptor').IdempotencyInterceptor;
	TypeOrmIdempotencyKeyRepository: typeof import('./repository/type-orm-idempotency-key.repository').TypeOrmIdempotencyKeyRepository;
	RequestContext: typeof import('../core/context/request-context').RequestContext;
	ApiException: typeof import('../core/errors/api-exception').ApiException;
	ApiErrorCode: typeof import('../core/errors/api-error-codes').ApiErrorCode;
	MultiORMEnum: typeof import('../core/utils').MultiORMEnum;
	IDEMPOTENT_METADATA_KEY: string;
}

type Store = 'MikroORM' | 'TypeORM';

/** One HTTP response, as the interceptor leaves it. */
interface ISent {
	status: number;
	headers: Record<string, string>;
	body: any;
	thrown: boolean;
}

describe('an idempotency key on the real stores, under DB_ORM=mikro-orm as under TypeORM', () => {
	const previousOrm = process.env.DB_ORM;
	const databaseFile = join(tmpdir(), `gauzy-idempotency-${randomUUID()}.sqlite3`);

	let platform: IPlatform;
	let orm: MikroORM;
	let dataSource: DataSource;

	/** A settle the interceptor logged as not recorded, and what the CRUD path logged with it. */
	let settleErrors: string[];

	beforeAll(async () => {
		// The decorators choose their ORM when an entity class is defined, and `CrudService` reads its ORM once, when
		// its module loads, so every platform module is required after this rather than imported above.
		process.env.DB_ORM = 'mikro-orm';
		jest.spyOn(console, 'log').mockImplementation(() => undefined);

		// The registry first: an entity imported before it can extend a base class that is not defined yet.
		const { coreEntities } = require('../core/entities');
		const { MikroORM: MikroOrm, EntityCaseNamingStrategy } = require('@mikro-orm/core');
		const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
		const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
		const { DataSource: TypeOrmDataSource } = require('typeorm');
		const { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } = require('@gauzy/config');
		const { CreateIdempotencyKeyTable1791000000010 } = require('../database/migrations/1791000000010-CreateIdempotencyKeyTable');
		const { ScopeIdempotencyKeyByTenant1791000000557 } = require('../database/migrations/1791000000557-ScopeIdempotencyKeyByTenant');

		platform = {
			IdempotencyKey: require('./idempotency-key.entity').IdempotencyKey,
			IdempotencyService: require('./idempotency.service').IdempotencyService,
			IdempotencyInterceptor: require('./idempotency.interceptor').IdempotencyInterceptor,
			TypeOrmIdempotencyKeyRepository: require('./repository/type-orm-idempotency-key.repository')
				.TypeOrmIdempotencyKeyRepository,
			RequestContext: require('../core/context/request-context').RequestContext,
			ApiException: require('../core/errors/api-exception').ApiException,
			ApiErrorCode: require('../core/errors/api-error-codes').ApiErrorCode,
			MultiORMEnum: require('../core/utils').MultiORMEnum,
			IDEMPOTENT_METADATA_KEY: require('./idempotency.policy').IDEMPOTENT_METADATA_KEY
		};

		// TypeORM first: its migrations own the schema, as they do on the platform.
		dataSource = new TypeOrmDataSource({
			type: 'better-sqlite3',
			database: databaseFile,
			entities: coreEntities,
			synchronize: false,
			migrationsRun: false,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();

		const runner = dataSource.createQueryRunner();
		try {
			await new CreateIdempotencyKeyTable1791000000010().up(runner);
			await new ScopeIdempotencyKeyByTenant1791000000557().up(runner);
		} finally {
			await runner.release();
		}

		// The tables a key's relations reach, with the columns a read of a key touches, and the caller's tenant and
		// organization in them. MikroORM joins a to-one relation whose target carries a filter — the soft-delete
		// one — to apply the filter to it, so every read of a key joins `tenant`, `organization` and `user`; a
		// relation whose row the join does not find is read as null, as a soft-deleted one is.
		for (const table of ['tenant', 'organization', 'user']) {
			await dataSource.query(`CREATE TABLE "${table}" ("id" varchar PRIMARY KEY NOT NULL, "deletedAt" datetime)`);
		}
		await dataSource.query('INSERT INTO "tenant" ("id") VALUES (?)', [TENANT]);
		await dataSource.query('INSERT INTO "organization" ("id") VALUES (?)', [ORGANIZATION]);

		// MikroORM on the same file, configured as `@gauzy/config` configures it for SQLite.
		orm = await MikroOrm.init({
			driver: BetterSqliteDriver,
			dbName: databaseFile,
			entities: coreEntities,
			persistOnCreate: true,
			extensions: [SoftDeleteHandler],
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: true,
			discovery: { warnWhenNoEntities: false }
		});
	}, ENTITY_GRAPH_TIMEOUT);

	afterAll(async () => {
		await orm?.close(true);
		await dataSource?.destroy();
		rmSync(databaseFile, { force: true });

		if (previousOrm === undefined) {
			delete process.env.DB_ORM;
		} else {
			process.env.DB_ORM = previousOrm;
		}
	});

	beforeEach(async () => {
		await dataSource.query('DELETE FROM "idempotency_key"');

		settleErrors = [];
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(platform.RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(platform.RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
		jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
			settleErrors.push(String(message));
		});
		jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
			settleErrors.push(args.map((arg) => (typeof arg === 'string' ? arg : inspect(arg, { depth: 1 }))).join(' '));
		});
	});

	afterEach(() => jest.restoreAllMocks());

	/**
	 * The service one request is served by: both repositories, as Nest injects them, and a fresh MikroORM context,
	 * as MikroORM's request context forks one per request — so a replay reads the store, not an identity map.
	 *
	 * On MikroORM the service runs on the ORM its module read at load, `DB_ORM=mikro-orm`; the TypeORM control
	 * states its ORM on the instance.
	 */
	function serviceOn(store: Store) {
		const service = new platform.IdempotencyService(
			new platform.TypeOrmIdempotencyKeyRepository(dataSource.getRepository(platform.IdempotencyKey) as never),
			orm.em.fork().getRepository(platform.IdempotencyKey) as never
		);

		if (store === 'TypeORM') {
			jest.spyOn(service, 'ormType', 'get').mockReturnValue(platform.MultiORMEnum.TypeORM);
		} else {
			expect(service.ormType).toBe(platform.MultiORMEnum.MikroORM);
		}

		return service;
	}

	/** One `POST` through the platform's interceptor, on a route declaring `@Idempotent({ scope, required: true })`. */
	async function send(store: Store, key: string, handler: () => Promise<unknown>): Promise<ISent> {
		const route = { complete: handler };
		Reflect.defineMetadata(
			platform.IDEMPOTENT_METADATA_KEY,
			{ scope: SCOPE, required: true, resourceType: 'order' },
			route.complete
		);

		const interceptor = new platform.IdempotencyInterceptor(serviceOn(store), new Reflector());
		const request = {
			method: 'POST',
			originalUrl: '/api/checkout/cart-1/complete',
			query: {},
			body: { cartId: 'cart-1' },
			headers: { 'idempotency-key': key }
		};
		// Nest sets the route's status before the interceptors run; a replay sets the stored one.
		const response = {
			statusCode: HttpStatus.CREATED as number,
			headers: {} as Record<string, string>,
			status(code: number) {
				this.statusCode = code;
				return this;
			},
			setHeader(name: string, value: string) {
				this.headers[name.toLowerCase()] = value;
			}
		};
		const context = {
			getType: () => 'http',
			getClass: () => class CheckoutController {},
			getHandler: () => route.complete,
			switchToHttp: () => ({ getRequest: () => request, getResponse: () => response })
		};

		try {
			const body = await lastValueFrom(
				interceptor.intercept(context as never, { handle: () => from(route.complete()) } as never) as never
			);
			return { status: response.statusCode, headers: response.headers, body, thrown: false };
		} catch (error) {
			const status = (error as { getStatus?: () => number })?.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
			return { status, headers: response.headers, body: error, thrown: true };
		}
	}

	/** The row a key resolves to, as the database holds it. */
	async function storedRow(key: string): Promise<Record<string, any> | undefined> {
		const [row] = await dataSource.query(
			'SELECT "id", "status", "responseStatus", "responseBody", "tenantId", "organizationId" FROM "idempotency_key" WHERE "key" = ?',
			[key]
		);
		return row;
	}

	describe.each<Store>(['MikroORM', 'TypeORM'])('on %s', (store) => {
		it(
			'settles the key with the response, answers the identical retry from it, and releases it',
			async () => {
				const key = `order-key-${store}`;
				const handler = jest.fn(async () => ORDER);

				const first = await send(store, key, handler);

				expect(first).toMatchObject({ thrown: false, status: HttpStatus.CREATED, body: ORDER });
				// The settle is what the defect broke, and the interceptor only logs it: the log is where it shows.
				expect(settleErrors).toEqual([]);

				// The row holds the response as JSON text — what TypeORM's `simple-json` column writes — under the
				// caller's tenant and organization.
				expect(await storedRow(key)).toEqual({
					id: expect.any(String),
					status: IdempotencyStatus.COMPLETED,
					responseStatus: HttpStatus.CREATED,
					responseBody: JSON.stringify(ORDER),
					tenantId: TENANT,
					organizationId: ORGANIZATION
				});

				// The identical retry is answered from the stored response, and the work is not run again.
				const retry = await send(store, key, handler);

				expect(handler).toHaveBeenCalledTimes(1);
				expect(retry).toMatchObject({ thrown: false, status: HttpStatus.CREATED, body: ORDER_AS_SENT });
				expect(retry.headers['idempotency-replayed']).toBe('true');

				// The operator's release is allowed, since the key is settled rather than in flight.
				const { id } = (await storedRow(key))!;
				const released = await serviceOn(store).release(id);

				expect(released).toMatchObject({ id, status: IdempotencyStatus.COMPLETED });
				expect(released).not.toHaveProperty('responseBody');
				expect(await storedRow(key)).toBeUndefined();

				// Released, the key is a first attempt again: the work runs.
				const again = await send(store, key, handler);

				expect(again).toMatchObject({ thrown: false, status: HttpStatus.CREATED, body: ORDER });
				expect(again.headers).not.toHaveProperty('idempotency-replayed');
				expect(handler).toHaveBeenCalledTimes(2);
				expect(settleErrors).toEqual([]);
			},
			ENTITY_GRAPH_TIMEOUT
		);

		it(
			'settles a refused request with the refusal body, and replays that refusal at its status',
			async () => {
				const key = `refused-key-${store}`;
				const handler = jest.fn(async () => {
					throw new platform.ApiException(
						HttpStatus.UNPROCESSABLE_ENTITY,
						platform.ApiErrorCode.VALIDATION_FAILED,
						'The cart has no lines.',
						{ cartId: 'cart-1', lines: [] }
					);
				});

				const first = await send(store, key, handler);

				expect(first).toMatchObject({ thrown: true, status: HttpStatus.UNPROCESSABLE_ENTITY });
				expect(settleErrors).toEqual([]);

				const row = await storedRow(key);
				expect(row).toMatchObject({ status: IdempotencyStatus.FAILED, responseStatus: HttpStatus.UNPROCESSABLE_ENTITY });
				const refusal = JSON.parse(row!.responseBody);
				expect(refusal).toMatchObject({
					code: platform.ApiErrorCode.VALIDATION_FAILED,
					details: { cartId: 'cart-1', lines: [] }
				});

				const retry = await send(store, key, handler);

				expect(handler).toHaveBeenCalledTimes(1);
				expect(retry).toMatchObject({ thrown: false, status: HttpStatus.UNPROCESSABLE_ENTITY, body: refusal });
				expect(retry.headers['idempotency-replayed']).toBe('true');
			},
			ENTITY_GRAPH_TIMEOUT
		);
	});

	it(
		'stores the same bytes on both ORMs, and each replays a key the other settled',
		async () => {
			const handler = jest.fn(async () => ORDER);

			await send('MikroORM', 'settled-on-mikro-orm', handler);
			await send('TypeORM', 'settled-on-typeorm', handler);

			expect(settleErrors).toEqual([]);
			expect((await storedRow('settled-on-mikro-orm'))?.responseBody).toBe(
				(await storedRow('settled-on-typeorm'))?.responseBody
			);

			// Both ORMs run on one database, so either may be the one that answers a retry of a key the other settled.
			const replayedOnTypeOrm = await send('TypeORM', 'settled-on-mikro-orm', handler);
			const replayedOnMikroOrm = await send('MikroORM', 'settled-on-typeorm', handler);

			expect(handler).toHaveBeenCalledTimes(2);
			for (const replayed of [replayedOnTypeOrm, replayedOnMikroOrm]) {
				expect(replayed).toMatchObject({ thrown: false, status: HttpStatus.CREATED, body: ORDER_AS_SENT });
				expect(replayed.headers['idempotency-replayed']).toBe('true');
			}
		},
		ENTITY_GRAPH_TIMEOUT
	);
});
