/**
 * This import must stay FIRST, before any import that pulls a core service (see the ORM parity suite).
 */
import '../../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DataSource } from 'typeorm';
import { BaseEntityEnum, EmployeeNotificationTypeEnum, IEmployeeNotificationCreateInput } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { coreEntities } from '../../core/entities';
import { RequestContext } from '../../core/context/request-context';
import { CreateEmployeeAppointmentReminderTable1791000018640 } from '../../database/migrations/1791000018640-CreateEmployeeAppointmentReminderTable';
import { EmployeeAppointmentReminder } from './employee-appointment-reminder.entity';
import { MEETING_REMINDER_STALE_CLAIM_MS } from './meeting-reminder.constants';
import { MeetingReminderService } from './meeting-reminder.service';

/**
 * The meeting reminder sweep against a real SQLite database: the appointments, their invitation rows, the employees,
 * their users' time zones and their notification settings as the platform stores them, and the
 * `employee_appointment_reminder` table its migration creates, whose unique key is what files each reminder once. The
 * notification service is doubled (it writes the notification's row, as the real one does): what is under test is
 * what the sweep asks it to file, under which id, for whom, and in which tenant's request context.
 */

const MINUTE = 60 * 1000;
const NOW = new Date('2026-11-12T12:45:00.000Z');
const at = (ms: number) => new Date(NOW.getTime() + ms);
/** A time as TypeORM writes it on SQLite: UTC, without its zone. */
const stored = (date: Date) => date.toISOString().replace('T', ' ').replace('Z', '');

const TENANT = randomUUID();
const OTHER_TENANT = randomUUID();
const ORGANIZATION = randomUUID();
const OTHER_ORGANIZATION = randomUUID();

interface IFiled {
	input: IEmployeeNotificationCreateInput & { id?: string };
	contextTenantId: string | null;
	contextOrganizationId: string | null;
}

describe('MeetingReminderService on SQLite', () => {
	let dataSource: DataSource;
	let filed: IFiled[];
	let notifications: { create: jest.Mock };
	let service: MeetingReminderService;
	const originalClsService = RequestContext['clsService'];

	beforeAll(() => RequestContext.setClsService(new ClsService(new AsyncLocalStorage())));
	afterAll(() => RequestContext.setClsService(originalClsService));

	beforeEach(async () => {
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);

		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: coreEntities,
			synchronize: false,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		// The columns the sweep reads, as the platform's own tables have them; the reminders' table from its migration.
		await dataSource.query(`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL)`);
		await dataSource.query(`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL)`);
		await dataSource.query(`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "timeZone" varchar, "deletedAt" datetime)`);
		await dataSource.query(
			`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "userId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "employee_appointment" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "employeeId" varchar, "agenda" varchar, "startDateTime" datetime, "endDateTime" datetime, "status" varchar, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "appointment_employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "appointmentId" varchar NOT NULL, "employeeAppointmentId" varchar, "employeeId" varchar, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "employee_notification_setting" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "employeeId" varchar, "preferences" text, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "employee_notification" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "entityId" varchar, "title" varchar, "deletedAt" datetime)`
		);
		const runner = dataSource.createQueryRunner();
		await new CreateEmployeeAppointmentReminderTable1791000018640().up(runner);
		await runner.release();
		for (const id of [TENANT, OTHER_TENANT]) await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?)`, [id]);
		for (const id of [ORGANIZATION, OTHER_ORGANIZATION])
			await dataSource.query(`INSERT INTO "organization" ("id") VALUES (?)`, [id]);

		filed = [];
		notifications = {
			create: jest.fn(async (input: IEmployeeNotificationCreateInput & { id?: string }) => {
				filed.push({
					input,
					contextTenantId: RequestContext.currentTenantId(),
					contextOrganizationId: RequestContext.currentOrganizationId()
				});
				await dataSource.query(
					`INSERT INTO "employee_notification" ("id", "tenantId", "entityId", "title") VALUES (?, ?, ?, ?)`,
					[input.id ?? randomUUID(), input.tenantId, input.entityId, input.title]
				);
				return { ...input };
			})
		};
		service = new MeetingReminderService(dataSource, notifications as never);
	});

	afterEach(async () => {
		await dataSource.destroy();
		jest.restoreAllMocks();
	});

	async function employee(
		options: {
			tenantId?: string;
			organizationId?: string;
			isActive?: boolean;
			isArchived?: boolean;
			deleted?: boolean;
			preferences?: unknown;
			timeZone?: string | null;
		} = {}
	): Promise<string> {
		const id = randomUUID();
		const userId = randomUUID();
		const tenantId = options.tenantId ?? TENANT;
		const organizationId = options.organizationId ?? ORGANIZATION;
		await dataSource.query(`INSERT INTO "user" ("id", "timeZone") VALUES (?, ?)`, [userId, options.timeZone ?? null]);
		await dataSource.query(
			`INSERT INTO "employee" ("id", "tenantId", "organizationId", "userId", "isActive", "isArchived", "deletedAt") VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				tenantId,
				organizationId,
				userId,
				options.isActive === false ? 0 : 1,
				options.isArchived ? 1 : 0,
				options.deleted ? stored(at(-60 * MINUTE)) : null
			]
		);
		if (options.preferences !== undefined) {
			await dataSource.query(
				`INSERT INTO "employee_notification_setting" ("id", "tenantId", "organizationId", "employeeId", "preferences") VALUES (?, ?, ?, ?, ?)`,
				[randomUUID(), tenantId, organizationId, id, JSON.stringify(options.preferences)]
			);
		}
		return id;
	}

	async function meeting(
		hostEmployeeId: string | null,
		options: {
			startsIn: number;
			lasts?: number;
			agenda?: string;
			status?: string | null;
			tenantId?: string;
			organizationId?: string;
			deleted?: boolean;
			invitees?: string[];
			/** Name the invitees by the old key only, as the rows written before `employeeAppointmentId` existed do. */
			oldKeyOnly?: boolean;
		}
	): Promise<string> {
		const id = randomUUID();
		const tenantId = options.tenantId ?? TENANT;
		const organizationId = options.organizationId ?? ORGANIZATION;
		const start = at(options.startsIn);
		await dataSource.query(
			`INSERT INTO "employee_appointment" ("id", "tenantId", "organizationId", "employeeId", "agenda", "startDateTime", "endDateTime", "status", "deletedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				tenantId,
				organizationId,
				hostEmployeeId,
				options.agenda ?? 'Sprint review',
				stored(start),
				stored(new Date(start.getTime() + (options.lasts ?? 30 * MINUTE))),
				options.status ?? null,
				options.deleted ? stored(at(-MINUTE)) : null
			]
		);
		for (const invitee of options.invitees ?? []) {
			await dataSource.query(
				`INSERT INTO "appointment_employee" ("id", "tenantId", "organizationId", "appointmentId", "employeeAppointmentId", "employeeId") VALUES (?, ?, ?, ?, ?, ?)`,
				[randomUUID(), tenantId, organizationId, id, options.oldKeyOnly ? null : id, invitee]
			);
		}
		return id;
	}

	const reminders = () => dataSource.getRepository(EmployeeAppointmentReminder).find();

	it('reminds the host and every invitee at their lead, once, about the meeting, in its tenant', async () => {
		const host = await employee();
		const invitee = await employee({ preferences: { meetingReminderMinutes: 15 } });
		const id = await meeting(host, { startsIn: 15 * MINUTE, invitees: [invitee] });

		const report = await service.sweep(NOW);
		await service.sweep(at(MINUTE / 2));

		expect(report).toEqual(expect.objectContaining({ checked: 1, reminded: 2, failed: 0 }));
		expect(filed).toHaveLength(2);
		expect(filed.map((one) => one.input.receiverEmployeeId).sort()).toEqual([host, invitee].sort());
		for (const one of filed) {
			expect(one.input).toEqual(
				expect.objectContaining({
					title: '"Sprint review" starts in 15 minutes',
					type: EmployeeNotificationTypeEnum.MEETING,
					entity: BaseEntityEnum.EmployeeAppointment,
					entityId: id,
					tenantId: TENANT,
					organizationId: ORGANIZATION
				})
			);
			expect(one.contextTenantId).toBe(TENANT);
			expect(one.contextOrganizationId).toBe(ORGANIZATION);
		}
		const claims = await reminders();
		expect(claims).toHaveLength(2);
		expect(claims.every((claim) => claim.filedAt)).toBe(true);
		expect(claims.map((claim) => claim.employeeNotificationId).sort()).toEqual(
			filed.map((one) => one.input.id).sort()
		);
	});

	it("names the meeting's time in each receiver's own time zone", async () => {
		const host = await employee({ timeZone: 'Europe/Paris' });
		const invitee = await employee({ timeZone: 'America/New_York' });
		await meeting(host, { startsIn: 15 * MINUTE, invitees: [invitee] });

		await service.sweep(NOW);

		const messageOf = (employeeId: string) =>
			filed.find((one) => one.input.receiverEmployeeId === employeeId)?.input.message;
		expect(messageOf(host)).toBe('Thursday, November 12, 2026, 2:00 – 2:30 PM (Europe/Paris)');
		expect(messageOf(invitee)).toBe('Thursday, November 12, 2026, 8:00 – 8:30 AM (America/New_York)');
	});

	it('follows each lead: a longer one is reminded earlier, none only at the start', async () => {
		const early = await employee({ preferences: { meetingReminderMinutes: 60 } });
		const none = await employee({ preferences: { meetingReminderMinutes: 0 } });
		await meeting(null, { startsIn: 30 * MINUTE, invitees: [early, none] });

		await service.sweep(NOW);
		expect(filed.map((one) => [one.input.receiverEmployeeId, one.input.title])).toEqual([
			[early, '"Sprint review" starts in 30 minutes']
		]);

		await service.sweep(at(29 * MINUTE));
		expect(filed.slice(1).map((one) => [one.input.receiverEmployeeId, one.input.title]).sort()).toEqual(
			[
				[early, '"Sprint review" is starting'],
				[none, '"Sprint review" is starting']
			].sort()
		);
	});

	it('files only the notice that it starts when both are due at once, and nothing once it is long started', async () => {
		const host = await employee();
		await meeting(host, { startsIn: 30 * 1000 });
		const late = await employee();
		await meeting(late, { startsIn: -6 * MINUTE });

		await service.sweep(NOW);

		expect(filed.map((one) => [one.input.receiverEmployeeId, one.input.title])).toEqual([
			[host, '"Sprint review" is starting']
		]);
	});

	it('reminds of a meeting moved to another time at its new time, and never at its old one', async () => {
		const host = await employee();
		const id = await meeting(host, { startsIn: 15 * MINUTE });
		await service.sweep(NOW);
		expect(filed).toHaveLength(1);

		// Moved an hour later: the reminder of the new time is due at its own lead, not now
		await dataSource.query(`UPDATE "employee_appointment" SET "startDateTime" = ?, "endDateTime" = ? WHERE "id" = ?`, [
			stored(at(75 * MINUTE)),
			stored(at(105 * MINUTE)),
			id
		]);
		await service.sweep(at(5 * MINUTE));
		expect(filed).toHaveLength(1);

		await service.sweep(at(60 * MINUTE));
		expect(filed).toHaveLength(2);
		expect(filed[1].input.title).toBe('"Sprint review" starts in 15 minutes');
		expect(await reminders()).toHaveLength(2);
	});

	it('reminds nobody of a meeting cancelled, completed or deleted', async () => {
		const host = await employee();
		await meeting(host, { startsIn: 10 * MINUTE, status: 'Cancelled' });
		await meeting(host, { startsIn: 10 * MINUTE, status: 'Completed' });
		await meeting(host, { startsIn: 10 * MINUTE, deleted: true });

		const report = await service.sweep(NOW);

		expect(report.checked).toBe(0);
		expect(filed).toEqual([]);
	});

	it('reminds no inactive, archived or deleted employee, nor an invitee of another tenant', async () => {
		const inactive = await employee({ isActive: false });
		const archived = await employee({ isArchived: true });
		const deleted = await employee({ deleted: true });
		const stranger = await employee({ tenantId: OTHER_TENANT, organizationId: OTHER_ORGANIZATION });
		const id = await meeting(inactive, { startsIn: 10 * MINUTE, invitees: [archived, deleted] });
		// A row of the other tenant naming this meeting
		await dataSource.query(
			`INSERT INTO "appointment_employee" ("id", "tenantId", "organizationId", "appointmentId", "employeeAppointmentId", "employeeId") VALUES (?, ?, ?, ?, ?, ?)`,
			[randomUUID(), OTHER_TENANT, OTHER_ORGANIZATION, id, id, stranger]
		);

		await service.sweep(NOW);

		expect(filed).toEqual([]);
	});

	it('reminds no employee of another organization of its tenant, as its host or as its invitee', async () => {
		const elsewhereHost = await employee({ organizationId: OTHER_ORGANIZATION });
		const elsewhereInvitee = await employee({ organizationId: OTHER_ORGANIZATION });
		const colleague = await employee();
		await meeting(elsewhereHost, { startsIn: 10 * MINUTE, invitees: [elsewhereInvitee, colleague] });

		await service.sweep(NOW);

		expect(filed.map((one) => one.input.receiverEmployeeId)).toEqual([colleague]);
	});

	it('files nothing for a meeting cancelled, moved or handed over, or for an invitee left out, while its page is reminded of', async () => {
		const host = await employee();
		const invitee = await employee();
		const leaver = await employee();
		const mover = await employee();
		const colleague = await employee();
		await meeting(host, { startsIn: 10 * MINUTE });
		const cancelled = await meeting(null, { startsIn: 11 * MINUTE, invitees: [invitee] });
		await meeting(null, { startsIn: 12 * MINUTE, invitees: [leaver] });
		const moved = await meeting(mover, { startsIn: 13 * MINUTE });
		const handedOver = await meeting(null, { startsIn: 14 * MINUTE, invitees: [colleague] });
		// While the first reminder is filed, the others are cancelled, moved, left by an invitee, and handed to another
		// organization
		const fileAsUsual = notifications.create.getMockImplementation() as (input: unknown) => Promise<unknown>;
		notifications.create.mockImplementationOnce(async (input: unknown) => {
			await dataSource.query(`UPDATE "employee_appointment" SET "status" = 'Cancelled' WHERE "id" = ?`, [cancelled]);
			await dataSource.query(`UPDATE "employee_appointment" SET "startDateTime" = ?, "endDateTime" = ? WHERE "id" = ?`, [
				stored(at(120 * MINUTE)),
				stored(at(150 * MINUTE)),
				moved
			]);
			await dataSource.query(`DELETE FROM "appointment_employee" WHERE "employeeId" = ?`, [leaver]);
			await dataSource.query(`UPDATE "employee_appointment" SET "organizationId" = ? WHERE "id" = ?`, [
				OTHER_ORGANIZATION,
				handedOver
			]);
			return fileAsUsual(input);
		});

		const report = await service.sweep(NOW);

		expect(report).toEqual(expect.objectContaining({ checked: 5, reminded: 1, failed: 0 }));
		expect(filed.map((one) => one.input.receiverEmployeeId)).toEqual([host]);
		// The claims of the reminders no longer due were given back
		expect(await reminders()).toHaveLength(1);
	});

	it('files no reminder whose moment passed while the reminders before it were filed', async () => {
		const first = await employee();
		const second = await employee();
		await meeting(first, { startsIn: 30 * 1000 });
		await meeting(second, { startsIn: 40 * 1000 });
		// The first filing takes ten minutes: the second meeting is then long started
		const realNow = Date.now;
		let late = 0;
		jest.spyOn(Date, 'now').mockImplementation(() => realNow.call(Date) + late);
		const fileAsUsual = notifications.create.getMockImplementation() as (input: unknown) => Promise<unknown>;
		notifications.create.mockImplementationOnce(async (input: unknown) => {
			late = 10 * MINUTE;
			return fileAsUsual(input);
		});

		const report = await service.sweep(NOW);

		expect(report).toEqual(expect.objectContaining({ reminded: 1, failed: 0 }));
		expect(filed.map((one) => one.input.receiverEmployeeId)).toEqual([first]);
		expect(await reminders()).toHaveLength(1);
	});

	it('reads an invitation row that names its meeting by the old key only', async () => {
		const invitee = await employee();
		await meeting(null, { startsIn: 10 * MINUTE, invitees: [invitee], oldKeyOnly: true });

		await service.sweep(NOW);

		expect(filed.map((one) => one.input.receiverEmployeeId)).toEqual([invitee]);
	});

	it('files each reminder once when two sweeps run at the same moment', async () => {
		const host = await employee();
		await meeting(host, { startsIn: 10 * MINUTE });

		await Promise.all([service.sweep(NOW), new MeetingReminderService(dataSource, notifications as never).sweep(NOW)]);

		expect(filed).toHaveLength(1);
		expect(await reminders()).toHaveLength(1);
	});

	it('gives a reminder that could not be filed back to the next sweep', async () => {
		const host = await employee();
		await meeting(host, { startsIn: 10 * MINUTE });
		notifications.create.mockRejectedValueOnce(new Error('down'));

		const failed = await service.sweep(NOW);
		expect(failed).toEqual(expect.objectContaining({ reminded: 0, failed: 1 }));
		expect(await reminders()).toHaveLength(0);

		const retried = await service.sweep(at(MINUTE));
		expect(retried).toEqual(expect.objectContaining({ reminded: 1, failed: 0 }));
		expect(filed.map((one) => one.input.title)).toEqual(['"Sprint review" starts in 9 minutes']);
	});

	it('takes over a claim a stopped process left unfiled, under its own id, or records the notification it wrote', async () => {
		const host = await employee();
		const id = await meeting(host, { startsIn: 20 * MINUTE });
		const stopped = new Date(at(5 * MINUTE).getTime() - MEETING_REMINDER_STALE_CLAIM_MS);
		const claim = {
			id: randomUUID(),
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			employeeAppointmentId: id,
			employeeId: host,
			level: 1,
			startDateTime: at(20 * MINUTE),
			employeeNotificationId: randomUUID(),
			claimedAt: new Date(Math.floor(stopped.getTime() / 1000) * 1000)
		};
		await dataSource.getRepository(EmployeeAppointmentReminder).insert(claim);

		const report = await service.sweep(at(5 * MINUTE));

		expect(report).toEqual(expect.objectContaining({ reminded: 1, recovered: 1 }));
		expect(filed.map((one) => one.input.id)).toEqual([claim.employeeNotificationId]);
		const [row] = await reminders();
		expect(row.filedAt).toBeTruthy();
	});

	it('leaves a claim alone while its process may still be filing it', async () => {
		const host = await employee();
		const id = await meeting(host, { startsIn: 10 * MINUTE });
		await dataSource.getRepository(EmployeeAppointmentReminder).insert({
			id: randomUUID(),
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			employeeAppointmentId: id,
			employeeId: host,
			level: 1,
			startDateTime: at(10 * MINUTE),
			employeeNotificationId: randomUUID(),
			claimedAt: new Date(Math.floor(NOW.getTime() / 1000) * 1000 - 30 * 1000)
		});

		await service.sweep(NOW);

		expect(filed).toEqual([]);
	});

	it('files the reminders of the second tenant in its own request context', async () => {
		const host = await employee({ tenantId: OTHER_TENANT, organizationId: OTHER_ORGANIZATION });
		await meeting(host, { startsIn: 10 * MINUTE, tenantId: OTHER_TENANT, organizationId: OTHER_ORGANIZATION });

		await service.sweep(NOW);

		expect(filed).toHaveLength(1);
		expect(filed[0].contextTenantId).toBe(OTHER_TENANT);
		expect(filed[0].contextOrganizationId).toBe(OTHER_ORGANIZATION);
		expect(filed[0].input.tenantId).toBe(OTHER_TENANT);
	});
});
