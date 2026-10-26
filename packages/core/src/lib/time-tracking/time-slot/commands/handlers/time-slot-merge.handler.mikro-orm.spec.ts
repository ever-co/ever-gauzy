import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * #10740 — the time slot merge under `DB_ORM=mikro-orm`.
 *
 * **The defect.** The merge that runs after slots are written (manual time, the timer's stop, the desktop timer's
 * slots) built a fresh `TimeSlot` from the serialized rows of each ten-minute group, carrying the first slot's id,
 * and handed it to `persistAndFlush`. MikroORM took it for a new row: it refused the plain time log objects in
 * `timeLogs`, or inserted an id `time_slot` already holds. The kept slot is now updated in place, and the
 * screenshots and activities of the other slots of the group are moved onto it before those slots are removed,
 * as TypeORM's `save()` does. `CreateTimeSlotHandler` reads the kept slot back with its screenshots through the
 * same entity manager right after the merge, so what it reads is asserted too.
 *
 * **What is real here.** One better-sqlite3 database whose tables TypeORM created from the platform's own mapping;
 * the core entities imported under `DB_ORM=mikro-orm`, so MikroORM maps them as in production, opened with the
 * platform's naming strategy, soft-delete extension and `autoJoinRefsForFilters`; and the real handler over a
 * real `MikroOrmTimeSlotRepository`. Only the command bus (timesheet and worked-hours recalculation) stands in.
 * The entities are imported in a registry kept open while MikroORM builds its metadata and the merge runs (see
 * `invoice.service.mikro-orm-pdf.spec.ts`).
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '10740000-0000-4000-8000-000000000001';
const ORGANIZATION = '10740000-0000-4000-8000-000000000002';
const USER = '10740000-0000-4000-8000-000000000003';
const EMPLOYEE = '10740000-0000-4000-8000-000000000004';
const LOG = '10740000-0000-4000-8000-000000000005';
/** The two slots of one ten-minute group: the first written is kept. */
const KEPT_SLOT = '10740000-0000-4000-8000-000000000011';
const MERGED_SLOT = '10740000-0000-4000-8000-000000000012';
const KEPT_SCREENSHOT = '10740000-0000-4000-8000-000000000021';
const MOVED_SCREENSHOT = '10740000-0000-4000-8000-000000000022';
const REMOVED_SCREENSHOT = '10740000-0000-4000-8000-000000000023';
const MOVED_ACTIVITY = '10740000-0000-4000-8000-000000000031';

/** What the merge left behind. */
interface IMerged {
	error?: string;
	/** The ids the merge answered. */
	answered?: string[];
	/** The kept slot as `CreateTimeSlotHandler` reads it back, through the same entity manager. */
	readBack?: { duration: number; timeLogs: string[]; screenshots: string[] };
	/** The rows as stored. */
	slots?: Array<{ id: string; duration: number; overall: number; deleted: boolean }>;
	links?: Array<{ timeSlotId: string; timeLogId: string }>;
	screenshotSlots?: Record<string, string>;
	activitySlots?: Record<string, string>;
}

async function mergeOnMikroOrm(): Promise<IMerged> {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = 'mikro-orm';

	const database = join(tmpdir(), `time-slot-merge-${process.pid}-${Date.now()}.sqlite`);
	const merged: IMerged = {};

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../../../core/entities');
			const { DataSource } = require('typeorm');
			const { MikroORM, EntityCaseNamingStrategy } = require('@mikro-orm/core');
			const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
			const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
			const { MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS } = require('@gauzy/config');
			const { RequestContext } = require('../../../../core/context/request-context');
			const { TimeSlot } = require('../../time-slot.entity');
			const { MikroOrmTimeSlotRepository } = require('../../repository/mikro-orm-time-slot.repository');
			const { TimeSlotMergeCommand } = require('../time-slot-merge.command');
			const { TimeSlotMergeHandler } = require('./time-slot-merge.handler');

			// The tables as TypeORM creates them from the platform's mapping.
			const dataSource = new DataSource({
				type: 'better-sqlite3',
				database,
				entities: coreEntities,
				synchronize: true,
				migrationsRun: false,
				logging: false
			});
			await dataSource.initialize();

			const orm = await MikroORM.init({
				driver: BetterSqliteDriver,
				dbName: database,
				entities: coreEntities,
				persistOnCreate: true,
				extensions: [SoftDeleteHandler],
				autoJoinRefsForFilters: MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
				namingStrategy: EntityCaseNamingStrategy,
				allowGlobalContext: true,
				discovery: { warnWhenNoEntities: false }
			});

			try {
				// The placeholder column of the custom-fields embeddables, which the migrations add and `synchronize`
				// does not (see `invoice.service.mikro-orm-pdf.spec.ts`).
				for (const table of ['employee', 'organization_project']) {
					await dataSource.query(`ALTER TABLE "${table}" ADD "fix_relational_custom_fields" boolean`);
				}

				// A date as MikroORM writes and compares it on this store.
				const platform = orm.em.getPlatform();
				const stored = (iso: string) => platform.processDateProperty(new Date(iso));

				// A row with the columns given, and a placeholder in every other NOT NULL column without a default.
				const insert = async (table: string, row: Record<string, unknown>) => {
					const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
					const values: Record<string, unknown> = { ...row };
					for (const column of columns) {
						if (column.name in values || !column.notnull || column.dflt_value !== null || column.pk)
							continue;
						const type = String(column.type).toLowerCase();
						values[column.name] = /int|bool|numeric|decimal|real|float/.test(type)
							? 0
							: /date|time/.test(type)
								? stored('2026-10-12T09:00:00.000Z')
								: 'x';
					}
					const keys = Object.keys(values);
					await dataSource.query(
						`INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(', ')}) VALUES (${keys
							.map(() => '?')
							.join(', ')})`,
						keys.map((key) => values[key])
					);
				};

				await dataSource.query('PRAGMA foreign_keys = OFF');
				const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
				await insert('tenant', { id: TENANT, name: 'Tenant' });
				await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
				await insert('user', { id: USER, tenantId: TENANT, firstName: 'Ada' });
				await insert('employee', { id: EMPLOYEE, ...scope, userId: USER });
				await insert('time_log', {
					id: LOG,
					...scope,
					employeeId: EMPLOYEE,
					startedAt: stored('2026-10-12T09:00:00.000Z'),
					stoppedAt: stored('2026-10-12T09:10:00.000Z')
				});
				for (const [id, startedAt, createdAt, duration, overall] of [
					[KEPT_SLOT, '2026-10-12T09:00:00.000Z', '2026-10-12T09:05:00.000Z', 300, 120],
					[MERGED_SLOT, '2026-10-12T09:05:00.000Z', '2026-10-12T09:10:00.000Z', 200, 80]
				] as const) {
					await insert('time_slot', {
						id,
						...scope,
						employeeId: EMPLOYEE,
						startedAt: stored(startedAt),
						createdAt: stored(createdAt),
						updatedAt: stored(createdAt),
						duration,
						overall,
						keyboard: 10,
						mouse: 10
					});
					await insert('time_slot_time_logs', { timeSlotId: id, timeLogId: LOG });
				}
				for (const [id, timeSlotId, deletedAt] of [
					[KEPT_SCREENSHOT, KEPT_SLOT, null],
					[MOVED_SCREENSHOT, MERGED_SLOT, null],
					[REMOVED_SCREENSHOT, MERGED_SLOT, stored('2026-10-12T09:11:00.000Z')]
				] as const) {
					// A screenshot belongs to the user who took it: the table has userId, not employeeId.
					await insert('screenshot', {
						id,
						...scope,
						userId: USER,
						timeSlotId,
						file: `${id}.png`,
						thumb: `${id}-thumb.png`,
						deletedAt
					});
				}
				await insert('activity', {
					id: MOVED_ACTIVITY,
					...scope,
					employeeId: EMPLOYEE,
					timeSlotId: MERGED_SLOT,
					title: 'editor',
					duration: 60
				});

				jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
				jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ tenantId: TENANT, employeeId: EMPLOYEE });

				// The request's entity manager, which the merge and the read after it share.
				const em = orm.em.fork();
				const handler = new TimeSlotMergeHandler({} as never, new MikroOrmTimeSlotRepository(em, TimeSlot), {
					execute: async () => undefined
				} as never);

				try {
					const answered = await handler.execute(
						new TimeSlotMergeCommand(
							ORGANIZATION,
							EMPLOYEE,
							new Date('2026-10-12T09:00:00.000Z'),
							new Date('2026-10-12T09:05:00.000Z')
						)
					);
					merged.answered = answered.map((slot: any) => slot.id);

					// What `CreateTimeSlotHandler` does right after the merge.
					const readBack: any = await em.findOne(
						'TimeSlot',
						{ id: KEPT_SLOT },
						{ populate: ['timeLogs', 'screenshots'] }
					);
					merged.readBack = {
						duration: readBack.duration,
						timeLogs: readBack.timeLogs.getItems().map((log: any) => log.id),
						screenshots: readBack.screenshots
							.getItems()
							.map((screenshot: any) => screenshot.id)
							.sort()
					};
				} catch (error) {
					merged.error = error instanceof Error ? error.message : String(error);
				}

				merged.slots = (
					await dataSource.query('SELECT id, duration, overall, deletedAt FROM time_slot ORDER BY id')
				).map((row: any) => ({
					id: row.id,
					duration: Number(row.duration),
					overall: Number(row.overall),
					deleted: row.deletedAt !== null
				}));
				merged.links = await dataSource.query(
					'SELECT timeSlotId, timeLogId FROM time_slot_time_logs ORDER BY timeSlotId'
				);
				merged.screenshotSlots = Object.fromEntries(
					(await dataSource.query('SELECT id, timeSlotId FROM screenshot')).map((row: any) => [
						row.id,
						row.timeSlotId
					])
				);
				merged.activitySlots = Object.fromEntries(
					(await dataSource.query('SELECT id, timeSlotId FROM activity')).map((row: any) => [
						row.id,
						row.timeSlotId
					])
				);
			} finally {
				jest.restoreAllMocks();
				await orm.close(true);
				await dataSource.destroy();
			}
		});
	} finally {
		if (previous === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previous;
		for (const file of [database, `${database}-wal`, `${database}-shm`]) {
			rmSync(file, { force: true });
		}
	}

	return merged;
}

describe('TimeSlotMergeHandler on MikroORM', () => {
	let merged: IMerged;

	beforeAll(async () => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		merged = await mergeOnMikroOrm();
	}, TIMEOUT);

	afterAll(() => jest.restoreAllMocks());

	it('merges a ten-minute group without failing, and answers the kept slot', () => {
		expect(merged.error).toBeUndefined();
		expect(merged.answered).toEqual([KEPT_SLOT]);
	});

	it('updates the kept slot in place with the group values, and removes the other one', () => {
		expect(merged.slots).toEqual([
			{ id: KEPT_SLOT, duration: 500, overall: 200, deleted: false },
			{ id: MERGED_SLOT, duration: 200, overall: 80, deleted: true }
		]);
	});

	it('links the kept slot to the group time log once', () => {
		expect(merged.links).toEqual([
			{ timeSlotId: KEPT_SLOT, timeLogId: LOG },
			{ timeSlotId: MERGED_SLOT, timeLogId: LOG }
		]);
	});

	it('moves the live screenshots and activities of the other slot onto the kept one', () => {
		expect(merged.screenshotSlots).toEqual({
			[KEPT_SCREENSHOT]: KEPT_SLOT,
			[MOVED_SCREENSHOT]: KEPT_SLOT,
			// A soft-removed screenshot is not loaded by TypeORM's merge either, and stays where it was.
			[REMOVED_SCREENSHOT]: MERGED_SLOT
		});
		expect(merged.activitySlots).toEqual({ [MOVED_ACTIVITY]: KEPT_SLOT });
	});

	it('reads the kept slot back with every screenshot it now holds, as the slot creation answers it', () => {
		expect(merged.readBack).toEqual({
			duration: 500,
			timeLogs: [LOG],
			screenshots: [KEPT_SCREENSHOT, MOVED_SCREENSHOT].sort()
		});
	});
});
