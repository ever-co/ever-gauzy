import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The registry's own tables are read and written through TypeORM under `DB_ORM=mikro-orm` too, and the flows
 * written for TypeORM rows run there.
 *
 * **The defect.** The registry is written for TypeORM rows: `PluginSubscription` and `PluginCategory` are TypeORM
 * closure-table trees, which MikroORM does not map, and the handlers call entity methods on the rows they read
 * and change their to-many relations as arrays. Its services inherited the kernel's `ormType`, which is `DB_ORM`,
 * so under `DB_ORM=mikro-orm` a read naming the tree (`relations: ['children', ...]`) was refused, and every
 * other read answered the plain serialized object, on which `subscription.cancel()` or
 * `pluginTenant.removeAllowedUser()` is not a function. Cancelling a subscription and deleting one both failed.
 *
 * **The pin.** Every registry CRUD service extends `RegistryCrudService` / `RegistryTenantAwareCrudService`, which
 * answer TypeORM whichever ORM `DB_ORM` names (`registry-crud.service.ts`). Both ORMs run on the one database in
 * either mode, and TypeORM's mapping is complete under MikroORM since d739d81b25, so the rows are the entities
 * the handlers were written for. Under `DB_ORM=typeorm` the kernel answers TypeORM already: nothing changes.
 *
 * **What is real here.** One better-sqlite3 file whose tables TypeORM created from the platform's own mapping —
 * the core entities and the registry's, imported under `DB_ORM=mikro-orm` (and `DB_TYPE=better-sqlite3`, which
 * the registry's dialect-dependent column types read) in a registry kept open while both ORMs build their
 * metadata and every flow runs, as `product.service.mikro-orm-translate.spec.ts` does — and MikroORM opened on the
 * same file with the platform's options. The services, handlers and subscribers are the registry's own, over the
 * registry's own TypeORM repository classes. Each flow is run twice over the same rows: once with the service
 * answering what the kernel answers (MikroORM, over a real MikroORM repository) — the defect — and once pinned,
 * where the MikroORM repository the service is handed records every member anything asks it for, so "MikroORM is
 * never reached" is measured rather than assumed.
 *
 * The registry's JSON columns are mapped as TypeORM's `simple-json` on SQLite, so the cancel handler's final save,
 * which writes `metadata`, runs on the mapping as it stands (declared `text`, the object was handed to better-sqlite3
 * as it was and the statement failed under either ORM).
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '7a000000-0000-4000-8000-000000000001';
const ORGANIZATION = '7a000000-0000-4000-8000-000000000002';
/** The caller: the user who bought the tenant subscription. */
const OWNER = '7a000000-0000-4000-8000-000000000010';
/** Two users the tenant subscription was assigned to, each holding a child subscription. */
const MEMBER_A = '7a000000-0000-4000-8000-000000000011';
const MEMBER_B = '7a000000-0000-4000-8000-000000000012';
/** A user whose own subscription the delete flow removes. */
const LEAVER = '7a000000-0000-4000-8000-000000000013';
/** The user who approved the plugin for the tenant. */
const APPROVER = '7a000000-0000-4000-8000-000000000014';

const PLUGIN = '7b000000-0000-4000-8000-000000000001';
const PLUGIN_TENANT = '7b000000-0000-4000-8000-000000000002';
const VERSION_OLD = '7b000000-0000-4000-8000-000000000003';
const VERSION_NEW = '7b000000-0000-4000-8000-000000000004';

/** The tenant subscription (the tree's root) and its two children. */
const PARENT = '7c000000-0000-4000-8000-000000000001';
const CHILD_A = '7c000000-0000-4000-8000-000000000002';
const CHILD_B = '7c000000-0000-4000-8000-000000000003';
/** A user subscription of its own, which the delete flow removes. */
const LEAVER_SUBSCRIPTION = '7c000000-0000-4000-8000-000000000004';

const REASON = 'No longer needed';

/** The outcome of one flow: what it answered, or the error it failed with. */
interface IOutcome {
	value?: any;
	error?: string;
	errorName?: string;
}

/** A subscription row as the table holds it. */
interface ISubscriptionRow {
	id: string;
	status: string;
	cancelledAt: string | null;
	cancellationReason: string | null;
	autoRenew: number;
	metadata: string | null;
}

/** What one read of the tenant subscription answered, as the handlers use it. */
interface IRowShape {
	error?: string;
	/** Whether the row carries `PluginSubscription.cancel`. */
	cancel: boolean;
	/** Whether its plugin tenant carries `PluginTenant.removeAllowedUser`. */
	removeAllowedUser: boolean;
	/** The children, when the row holds them as an array. */
	children?: string[];
}

/** Everything the suite asserts, collected while the isolated registry is open. */
interface IObserved {
	/** `CrudService.ormType` — the kernel's answer — in this process. */
	kernelOrmType: string;
	/** Every registry service the module provides, whether it is a CRUD service, and what it answers. */
	services: Array<{ name: string; crud: boolean; pinned: boolean; ormType?: string }>;
	/** The subscribers the registry hands the platform's MikroORM (and TypeORM) configuration. */
	pluginSubscribers: string[];
	/** The subscription rows before either cancel run. */
	seeded: ISubscriptionRow[];
	/** The tenant subscription read through the unpinned service (with and without the tree) and the pinned one. */
	reads: { unpinnedTree: IRowShape; unpinnedFlat: IRowShape; pinned: IRowShape };
	cancel: {
		unpinned: { outcome: IOutcome; rows: ISubscriptionRow[] };
		pinned: { outcome: IOutcome; rows: ISubscriptionRow[]; loadedBySubscriber: string[] };
	};
	delete: {
		unpinned: { outcome: IOutcome; stillStored: boolean };
		pinned: { outcome: IOutcome; stillStored: boolean };
	};
	pluginWrite: {
		created: { error?: string };
		stored?: { name: string; uploadedById: string | null; uploadedAt: string | null };
		read: { error?: string; downloadCount?: number; version?: string; installed?: boolean };
		search: IOutcome;
	};
	/** Every member a pinned service asked of its MikroORM repository. */
	mikroOrmReached: string[];
}

async function attempt(run: () => Promise<unknown>): Promise<IOutcome> {
	try {
		return { value: await run() };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : String(error),
			errorName: error instanceof Error ? error.constructor.name : undefined
		};
	}
}

async function observe(): Promise<IObserved> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	process.env.DB_TYPE = 'better-sqlite3';

	const database = join(tmpdir(), `registry-orm-pin-${process.pid}-${Date.now()}.sqlite`);
	const observed: Partial<IObserved> = {};

	try {
		await jest.isolateModulesAsync(async () => {
			const { Logger } = require('@nestjs/common');
			const { DataSource } = require('typeorm');
			const { MikroORM, EntityCaseNamingStrategy } = require('@mikro-orm/core');
			const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
			const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
			const { MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS, TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } = require('@gauzy/config');
			const { coreEntities, CrudService, RequestContext, Tenant } = require('@gauzy/core');
			const { getSubscribersFromPlugins } = require('@gauzy/plugin');
			// The package as the platform loads it, so its modules are evaluated in their own order.
			const registry = require('../../../index');
			const { CancelPluginSubscriptionCommandHandler } = require(
				'../../application/plugin-subscription/commands/handlers/cancel-plugin-subscription.handler'
			);
			const { CancelPluginSubscriptionCommand } = require(
				'../../application/plugin-subscription/commands/cancel-plugin-subscription.command'
			);
			const { DeletePluginSubscriptionCommandHandler } = require(
				'../../application/plugin-subscription/commands/handlers/delete-plugin-subscription.handler'
			);
			const { DeletePluginSubscriptionCommand } = require(
				'../../application/plugin-subscription/commands/delete-plugin-subscription.command'
			);
			const { SearchPluginsQueryHandler } = require(
				'../../application/plugin/queries/handlers/search-plugins-query.handler'
			);
			const { SearchPluginsQuery } = require('../../application/plugin/queries/search-plugins.query');

			// The subscribers log every load at debug level; a failure still reaches the error log.
			Logger.overrideLogger(['error', 'warn']);

			const { entities, Plugin, PluginSubscription, PluginTenant, PluginVersion } = registry;

			// The tables as TypeORM creates them from the platform's mapping.
			const dataSource = new DataSource({
				type: 'better-sqlite3',
				database,
				entities: [...coreEntities, ...entities],
				synchronize: true,
				migrationsRun: false,
				logging: false,
				invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
			});
			await dataSource.initialize();

			let orm: any;
			try {
				orm = await MikroORM.init({
					driver: BetterSqliteDriver,
					dbName: database,
					entities: [...coreEntities, ...entities],
					persistOnCreate: true,
					extensions: [SoftDeleteHandler],
					autoJoinRefsForFilters: MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
					namingStrategy: EntityCaseNamingStrategy,
					allowGlobalContext: true,
					discovery: { warnWhenNoEntities: false }
				});
			} catch (error) {
				await dataSource.destroy();
				throw error;
			}

			try {
				/*
				 * The pin, as every service of the module answers it.
				 */
				const kernelOrmType: string = Object.getOwnPropertyDescriptor(CrudService.prototype, 'ormType').get.call(
					{}
				);
				observed.kernelOrmType = kernelOrmType;
				observed.services = registry.services.map((service: any) => {
					const crud = service.prototype instanceof CrudService;
					return {
						name: service.name,
						crud,
						pinned:
							service.prototype instanceof registry.RegistryCrudService ||
							service.prototype instanceof registry.RegistryTenantAwareCrudService,
						...(crud ? { ormType: Object.create(service.prototype).ormType } : {})
					};
				});
				observed.pluginSubscribers = getSubscribersFromPlugins([registry.RegistryPlugin]).map(
					(subscriber: { name: string }) => subscriber.name
				);

				/*
				 * The rows. Foreign keys are off: the users, roles and organization the rows name are not what this
				 * suite is about. The tenant is stored, because TypeORM's tenant scope is a join to it.
				 */
				await dataSource.query('PRAGMA foreign_keys = OFF');
				await dataSource.getRepository(Tenant).insert([{ id: TENANT, name: 'Registry' }]);
				await dataSource.getRepository(Plugin).insert([{ id: PLUGIN, name: 'Pinned plugin' }]);
				await dataSource.getRepository(PluginTenant).insert([
					{
						id: PLUGIN_TENANT,
						pluginId: PLUGIN,
						tenantId: TENANT,
						organizationId: ORGANIZATION,
						approvedById: APPROVER
					}
				]);
				await dataSource.getRepository(PluginVersion).insert([
					{
						id: VERSION_OLD,
						pluginId: PLUGIN,
						number: '1.9.0',
						changelog: 'Older',
						downloadCount: 7,
						tenantId: TENANT,
						organizationId: ORGANIZATION
					},
					{
						id: VERSION_NEW,
						pluginId: PLUGIN,
						number: '1.10.0',
						changelog: 'Newer',
						downloadCount: 5,
						tenantId: TENANT,
						organizationId: ORGANIZATION
					}
				]);

				// The tree through TypeORM's own tree persistence, so the closure table holds what production's does.
				const subscriptions = dataSource.getRepository(PluginSubscription);
				const common = {
					status: 'active',
					pluginId: PLUGIN,
					pluginTenantId: PLUGIN_TENANT,
					tenantId: TENANT,
					organizationId: ORGANIZATION,
					autoRenew: true
				};
				const parent = await subscriptions.save(
					subscriptions.create({ ...common, id: PARENT, scope: 'tenant', subscriberId: OWNER })
				);
				for (const [id, subscriberId] of [
					[CHILD_A, MEMBER_A],
					[CHILD_B, MEMBER_B]
				]) {
					await subscriptions.save(
						subscriptions.create({ ...common, id, scope: 'user', subscriberId, parentId: PARENT, parent })
					);
				}
				await subscriptions.save(
					subscriptions.create({ ...common, id: LEAVER_SUBSCRIPTION, scope: 'user', subscriberId: LEAVER })
				);

				const readRows = (ids: string[]): Promise<ISubscriptionRow[]> =>
					dataSource.query(
						`SELECT id, status, cancelledAt, cancellationReason, autoRenew, metadata FROM plugin_subscriptions
						WHERE id IN (${ids.map(() => '?').join(', ')}) ORDER BY id`,
						ids
					);
				const TREE = [PARENT, CHILD_A, CHILD_B];
				observed.seeded = await readRows(TREE);

				/*
				 * The caller: the owner of the tenant subscription, as the tenant guard leaves the request context.
				 */
				jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({});
				jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
					id: OWNER,
					tenantId: TENANT,
					employeeId: null
				});
				jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(OWNER);
				jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
				jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
				jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
				jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

				/** A MikroORM repository that records every member it is asked for, and answers none. */
				const reached: string[] = [];
				const unreachable = new Proxy(
					{},
					{
						get: (_target, member) => {
							reached.push(String(member));
							return () => {
								throw new Error(`MikroORM repository reached: ${String(member)}`);
							};
						}
					}
				);

				/** A registry service over its real TypeORM repository class, pinned. */
				const pinned = (Service: any, TypeOrmRepository: any, entity: unknown, ...rest: unknown[]) =>
					new Service(new TypeOrmRepository(dataSource.getRepository(entity)), unreachable, ...rest);

				/**
				 * The same service as it was before the pin: answering the kernel's ORM, over a real MikroORM
				 * repository on the same file (a fresh context each, so an answer is the store's).
				 */
				const unpinned = (
					Service: any,
					TypeOrmRepository: any,
					MikroOrmRepository: any,
					entity: unknown,
					...rest: unknown[]
				) => {
					const service = new Service(
						new TypeOrmRepository(dataSource.getRepository(entity)),
						new MikroOrmRepository(orm.em.fork(), entity),
						...rest
					);
					Object.defineProperty(service, 'ormType', { get: () => kernelOrmType });
					return service;
				};

				const subscriptionService = (pin: boolean) =>
					pin
						? pinned(
								registry.PluginSubscriptionService,
								registry.TypeOrmPluginSubscriptionRepository,
								PluginSubscription
						  )
						: unpinned(
								registry.PluginSubscriptionService,
								registry.TypeOrmPluginSubscriptionRepository,
								registry.MikroOrmPluginSubscriptionRepository,
								PluginSubscription
						  );
				const pluginTenantService = (pin: boolean) =>
					pin
						? pinned(registry.PluginTenantService, registry.TypeOrmPluginTenantRepository, PluginTenant)
						: unpinned(
								registry.PluginTenantService,
								registry.TypeOrmPluginTenantRepository,
								registry.MikroOrmPluginTenantRepository,
								PluginTenant
						  );

				/*
				 * The two halves of the defect, read by themselves: the cancel handler's read with the relations it
				 * names, and the same read without the two tree paths, whose row is then asked for the domain methods
				 * the handlers call on it.
				 */
				const CANCEL_RELATIONS = ['plan', 'plugin', 'pluginTenant', 'children', 'children.pluginTenant'];
				const TREE_PATHS = ['children', 'children.pluginTenant'];
				const treeRead = await attempt(() =>
					subscriptionService(false).findOneByIdString(PARENT, { relations: CANCEL_RELATIONS })
				);
				const flatRead = await attempt(() =>
					subscriptionService(false).findOneByIdString(PARENT, {
						relations: CANCEL_RELATIONS.filter((relation) => !TREE_PATHS.includes(relation))
					})
				);
				const pinnedRead = await attempt(() =>
					subscriptionService(true).findOneByIdString(PARENT, { relations: CANCEL_RELATIONS })
				);
				const shapeOf = (outcome: IOutcome): IRowShape => ({
					error: outcome.error,
					cancel: typeof outcome.value?.cancel === 'function',
					removeAllowedUser: typeof outcome.value?.pluginTenant?.removeAllowedUser === 'function',
					children: Array.isArray(outcome.value?.children)
						? outcome.value.children.map((child: { id: string }) => child.id).sort()
						: undefined
				});
				observed.reads = {
					unpinnedTree: shapeOf(treeRead),
					unpinnedFlat: shapeOf(flatRead),
					pinned: shapeOf(pinnedRead)
				};

				/*
				 * Cancelling the tenant subscription cascades to its children: a read of the tree, a domain method on
				 * each row, and a save of the parent that carries the children with it.
				 */
				const cancel = (pin: boolean) =>
					attempt(() =>
						new CancelPluginSubscriptionCommandHandler(subscriptionService(pin)).execute(
							new CancelPluginSubscriptionCommand(PARENT, REASON)
						)
					);

				const unpinnedCancel = await cancel(false);
				const unpinnedRows = await readRows(TREE);

				// The registry's own TypeORM subscriber on the subscriptions, on the data source it is pushed onto.
				const subscriptionSubscriber = new registry.PluginSubscriptionSubscriber(dataSource);
				const afterLoad = jest.spyOn(subscriptionSubscriber, 'afterLoad');
				const pinnedCancel = await cancel(true);
				observed.cancel = {
					unpinned: { outcome: unpinnedCancel, rows: unpinnedRows },
					pinned: {
						outcome: pinnedCancel,
						rows: await readRows(TREE),
						loadedBySubscriber: afterLoad.mock.calls.map(([row]: [{ id: string }]) => row.id)
					}
				};

				/*
				 * Deleting a user's subscription takes the user off the plugin tenant's allowed list (a domain method
				 * on the plugin tenant row) and removes the subscription.
				 */
				const isStored = async (id: string) =>
					(await dataSource.query('SELECT id FROM plugin_subscriptions WHERE id = ?', [id])).length > 0;
				const remove = (pin: boolean) =>
					attempt(() =>
						new DeletePluginSubscriptionCommandHandler(
							subscriptionService(pin),
							pluginTenantService(pin)
						).execute(new DeletePluginSubscriptionCommand(LEAVER_SUBSCRIPTION, PLUGIN_TENANT))
					);
				const unpinnedDelete = await remove(false);
				const unpinnedStillStored = await isStored(LEAVER_SUBSCRIPTION);
				const pinnedDelete = await remove(true);
				observed.delete = {
					unpinned: { outcome: unpinnedDelete, stillStored: unpinnedStillStored },
					pinned: { outcome: pinnedDelete, stillStored: await isStored(LEAVER_SUBSCRIPTION) }
				};

				/*
				 * A plugin written and read through the pinned services, with the registry's `PluginSubscriber` on the
				 * TypeORM data source: its `beforeInsert` normalizes and stamps the row, its `afterLoad` computes the
				 * download count, the latest version and the installation state through the pinned services.
				 */
				const versionService = pinned(
					registry.PluginVersionService,
					registry.TypeOrmPluginVersionRepository,
					PluginVersion
				);
				new registry.PluginSubscriber(
					versionService,
					pinned(registry.PluginSourceService, registry.TypeOrmPluginSourceRepository, registry.PluginSource),
					pinned(
						registry.PluginInstallationService,
						registry.TypeOrmPluginInstallationRepository,
						registry.PluginInstallation
					),
					pinned(
						registry.PluginSubscriptionPlanService,
						registry.TypeOrmPluginSubscriptionPlanRepository,
						registry.PluginSubscriptionPlan
					),
					dataSource
				);
				const pluginService = pinned(registry.PluginService, registry.TypeOrmPluginRepository, Plugin, {});
				const created = await attempt(() => pluginService.create({ name: '  Written through the pin  ' }));
				const [stored] = created.value
					? await dataSource.query('SELECT name, uploadedById, uploadedAt FROM plugins WHERE id = ?', [
							created.value.id
					  ])
					: [];
				const read = await attempt(() => pluginService.findOneByIdString(PLUGIN));
				observed.pluginWrite = {
					created: { error: created.error },
					stored,
					read: {
						error: read.error,
						downloadCount: read.value?.downloadCount,
						version: read.value?.version?.number,
						installed: read.value?.installed
					},
					search: await attempt(() =>
						new SearchPluginsQueryHandler(pluginService).execute(new SearchPluginsQuery({ take: 10 } as any))
					)
				};

				observed.mikroOrmReached = reached;
			} finally {
				jest.restoreAllMocks();
				await orm.close(true);
				await dataSource.destroy();
			}
		});
	} finally {
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		for (const file of [database, `${database}-wal`, `${database}-shm`]) {
			rmSync(file, { force: true });
		}
	}

	return observed as IObserved;
}

describe('Registry services — pinned to TypeORM under DB_ORM=mikro-orm', () => {
	let observed: IObserved;

	beforeAll(async () => {
		observed = await observe();
	}, TIMEOUT);

	it('runs in a MikroORM process: the kernel answers MikroORM for its own services', () => {
		// The premise, stated so the suite fails loudly if it stops holding.
		expect(observed.kernelOrmType).toBe('mikro-orm');
	});

	it('answers TypeORM from every registry CRUD service, each through the pinned bases', () => {
		const crud = observed.services.filter((service) => service.crud);

		expect(crud.map((service) => service.name).sort()).toEqual(
			[
				'PluginBillingService',
				'PluginCategoryService',
				'PluginInstallationService',
				'PluginService',
				'PluginSettingService',
				'PluginSourceService',
				'PluginSubscriptionPlanService',
				'PluginSubscriptionService',
				'PluginTagService',
				'PluginTenantService',
				'PluginVersionService'
			].sort()
		);
		for (const service of crud) {
			expect(service).toEqual({ name: service.name, crud: true, pinned: true, ormType: 'typeorm' });
		}
		// The rest of the module's services hold no repository of their own; they work through the ones above.
		expect(
			observed.services
				.filter((service) => !service.crud)
				.map((service) => service.name)
				.sort()
		).toEqual(['PluginSecurityService', 'PluginSubscriptionAccessService', 'PluginUserAssignmentService']);
	});

	it('hands MikroORM no subscriber: the registry’s subscribers live on the TypeORM data source alone', () => {
		// `preBootstrapRegisterSubscribers` gives the plugins' declared subscribers to BOTH ORMs' configuration. The
		// registry declares none; each of its subscribers pushes itself onto the TypeORM data source instead, so a
		// write through the pinned services fires it once, and nothing on the MikroORM side can fire it again.
		expect(observed.pluginSubscribers).toEqual([]);
	});

	describe('reading the tenant subscription with the cancel handler’s relations', () => {
		it('was refused on the unpinned service, which has no `children` to load', () => {
			expect(observed.reads.unpinnedTree.error).toBeDefined();
		});

		it('answered a row without the domain methods on the unpinned service, once the tree paths are left out', () => {
			// Without `children` and `children.pluginTenant` the read succeeds — the tree is the only thing in it
			// MikroORM lacks — but what it answers is the serialized row, on which every handler's
			// `subscription.cancel()` or `pluginTenant.removeAllowedUser()` is not a function.
			expect(observed.reads.unpinnedFlat).toEqual({
				error: undefined,
				cancel: false,
				removeAllowedUser: false,
				children: undefined
			});
		});

		it('answers the entity with its methods and its children as an array when pinned', () => {
			expect(observed.reads.pinned).toEqual({
				error: undefined,
				cancel: true,
				removeAllowedUser: true,
				children: [CHILD_A, CHILD_B]
			});
		});
	});

	describe('cancelling a tenant subscription with two children', () => {
		it('failed on the unpinned service at the read of the tree, and nothing was written', () => {
			const { outcome, rows } = observed.cancel.unpinned;

			expect(outcome.errorName).toBe('BadRequestException');
			expect(outcome.error).toBe(`Failed to cancel subscription: ${observed.reads.unpinnedTree.error}`);
			expect(rows).toEqual(observed.seeded);
		});

		it('cancels the parent and cascades to both children when pinned', () => {
			const { outcome, rows } = observed.cancel.pinned;
			expect(outcome.error).toBeUndefined();
			expect(outcome.value).toMatchObject({ id: PARENT, status: 'cancelled' });

			const [parent, childA, childB] = rows;
			expect(parent).toMatchObject({
				id: PARENT,
				status: 'cancelled',
				cancellationReason: REASON,
				autoRenew: 0
			});
			expect(parent.cancelledAt).toBeTruthy();
			expect(JSON.parse(parent.metadata)).toMatchObject({ cancelledChildCount: 2, cancelledBy: OWNER });

			for (const [child, id] of [
				[childA, CHILD_A],
				[childB, CHILD_B]
			] as const) {
				expect(child).toMatchObject({
					id,
					status: 'cancelled',
					cancellationReason: `Parent subscription cancelled: ${REASON}`,
					autoRenew: 0
				});
				expect(child.cancelledAt).toBeTruthy();
			}
		});

		it('fires the registry’s TypeORM subscriber for every row the pinned read loaded', () => {
			expect(new Set(observed.cancel.pinned.loadedBySubscriber)).toEqual(new Set([PARENT, CHILD_A, CHILD_B]));
		});
	});

	describe('deleting a user’s subscription', () => {
		it('failed on the unpinned service: the plugin tenant row carried no domain methods', () => {
			const { outcome, stillStored } = observed.delete.unpinned;

			expect(outcome.errorName).toBe('BadRequestException');
			expect(outcome.error).toMatch(/^Failed to delete plugin subscription: .*removeAllowedUser is not a function/);
			expect(stillStored).toBe(true);
		});

		it('removes the subscription when pinned', () => {
			const { outcome, stillStored } = observed.delete.pinned;

			expect(outcome.error).toBeUndefined();
			expect(stillStored).toBe(false);
		});
	});

	describe('a plugin written and read through the pinned services', () => {
		it('is normalized and stamped by the registry’s TypeORM subscriber on insert', () => {
			const { created, stored } = observed.pluginWrite;

			expect(created.error).toBeUndefined();
			expect(stored).toMatchObject({ name: 'Written through the pin', uploadedById: OWNER });
			expect(stored.uploadedAt).toBeTruthy();
		});

		it('is answered with what the subscriber computes on load, through the pinned services', () => {
			// 7 + 5 downloads; 1.10.0 is the later version, where a string comparison would take 1.9.0 for it.
			expect(observed.pluginWrite.read).toEqual({
				error: undefined,
				downloadCount: 12,
				version: '1.10.0',
				installed: false
			});
		});

		it('is found by the search handler, which now follows the plugin service’s ORM', () => {
			const { search } = observed.pluginWrite;

			expect(search.error).toBeUndefined();
			expect(search.value.total).toBe(2);
			expect(search.value.items.find((item: any) => item.id === PLUGIN)).toMatchObject({
				downloadCount: 12,
				version: expect.objectContaining({ number: '1.10.0' })
			});
		});
	});

	it('never reached a MikroORM repository from a pinned service', () => {
		expect(observed.mikroOrmReached).toEqual([]);
	});
});
