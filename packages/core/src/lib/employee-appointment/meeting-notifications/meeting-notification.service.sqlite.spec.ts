/**
 * This import must stay FIRST, before any import that pulls a core service (see the ORM parity suite).
 */
import '../../core/entities/internal';

import { randomUUID } from 'node:crypto';
import { BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseEntityEnum, EmployeeNotificationTypeEnum, IEmployeeNotificationCreateInput } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { coreEntities } from '../../core/entities';
import { IMeetingSnapshot, MeetingNotificationService } from './meeting-notification.service';

/**
 * The invitees of a meeting and what they are told, against a real SQLite database: the appointments, their invitation
 * rows, the employees and their users as the platform stores them. The notification service is doubled: what is under
 * test is who is invited, who is told what, and what an invitee can read.
 */

const MINUTE = 60 * 1000;
const NOW = Date.parse('2026-11-12T12:00:00.000Z');
const stored = (date: Date) => date.toISOString().replace('T', ' ').replace('Z', '');

const TENANT = randomUUID();
const OTHER_TENANT = randomUUID();
const ORGANIZATION = randomUUID();
const OTHER_ORGANIZATION = randomUUID();

describe('MeetingNotificationService on SQLite', () => {
	let dataSource: DataSource;
	let notifications: { create: jest.Mock };
	let service: MeetingNotificationService;

	beforeEach(async () => {
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: coreEntities,
			synchronize: false,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		await dataSource.query(
			`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "firstName" varchar, "lastName" varchar, "email" varchar, "timeZone" varchar, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "userId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "employee_appointment" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "employeeId" varchar, "agenda" varchar, "description" varchar, "location" varchar, "startDateTime" datetime, "endDateTime" datetime, "status" varchar, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "appointment_employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "appointmentId" varchar NOT NULL, "employeeAppointmentId" varchar, "employeeId" varchar, "deletedAt" datetime)`
		);
		notifications = { create: jest.fn(async (input: IEmployeeNotificationCreateInput) => ({ ...input })) };
		service = new MeetingNotificationService(dataSource, notifications as never);
	});

	afterEach(async () => {
		await dataSource.destroy();
		jest.restoreAllMocks();
	});

	async function employee(
		options: { tenantId?: string; organizationId?: string; name?: [string, string]; timeZone?: string; deleted?: boolean } = {}
	): Promise<string> {
		const id = randomUUID();
		const userId = randomUUID();
		await dataSource.query(
			`INSERT INTO "user" ("id", "firstName", "lastName", "email", "timeZone") VALUES (?, ?, ?, ?, ?)`,
			[userId, options.name?.[0] ?? null, options.name?.[1] ?? null, `${id}@example.com`, options.timeZone ?? null]
		);
		await dataSource.query(
			`INSERT INTO "employee" ("id", "tenantId", "organizationId", "userId", "deletedAt") VALUES (?, ?, ?, ?, ?)`,
			[
				id,
				options.tenantId ?? TENANT,
				options.organizationId ?? ORGANIZATION,
				userId,
				options.deleted ? stored(new Date(NOW)) : null
			]
		);
		return id;
	}

	async function appointment(
		hostEmployeeId: string | null,
		options: { startsIn?: number; status?: string; agenda?: string; organizationId?: string } = {}
	): Promise<IMeetingSnapshot> {
		const id = randomUUID();
		const start = new Date(NOW + (options.startsIn ?? 60 * MINUTE));
		const end = new Date(start.getTime() + 30 * MINUTE);
		await dataSource.query(
			`INSERT INTO "employee_appointment" ("id", "tenantId", "organizationId", "employeeId", "agenda", "location", "startDateTime", "endDateTime", "status") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				TENANT,
				options.organizationId ?? ORGANIZATION,
				hostEmployeeId,
				options.agenda ?? 'Sprint review',
				'https://app.ever.team/meet/jitsi?room=U3ByaW50',
				stored(start),
				stored(end),
				options.status ?? null
			]
		);
		return {
			id,
			tenantId: TENANT,
			organizationId: options.organizationId ?? ORGANIZATION,
			employeeId: hostEmployeeId,
			agenda: options.agenda ?? 'Sprint review',
			startDateTime: start,
			endDateTime: end
		};
	}

	describe('checkedInviteeIdsOf', () => {
		it('keeps employees of the organization once each, without the host', async () => {
			const host = await employee();
			const first = await employee();
			const second = await employee();

			const ids = await service.checkedInviteeIdsOf(
				[first, second, first, host],
				{ organizationId: ORGANIZATION, tenantId: TENANT },
				host
			);

			expect(ids).toEqual([first, second]);
		});

		it('refuses someone of another organization or tenant, a deleted employee, and anything but a list of ids', async () => {
			const scope = { organizationId: ORGANIZATION, tenantId: TENANT };
			const elsewhere = await employee({ organizationId: OTHER_ORGANIZATION });
			const stranger = await employee({ tenantId: OTHER_TENANT });
			const gone = await employee({ deleted: true });

			for (const value of [[elsewhere], [stranger], [gone], [randomUUID()]]) {
				await expect(service.checkedInviteeIdsOf(value, scope)).rejects.toBeInstanceOf(BadRequestException);
			}
			for (const value of ['someone', [42], [''], null]) {
				await expect(service.checkedInviteeIdsOf(value, scope)).rejects.toThrow(
					'inviteeEmployeeIds must be a list of employee ids.'
				);
			}
			expect(await service.checkedInviteeIdsOf([], scope)).toEqual([]);
		});
	});

	describe('replaceInvitees', () => {
		it('stores the invitees under both keys, and says who was added, removed and kept', async () => {
			const meeting = await appointment(await employee());
			const [first, second, third] = [await employee(), await employee(), await employee()];

			expect(await service.replaceInvitees(meeting, [first, second])).toEqual({
				added: [first, second],
				removed: [],
				kept: []
			});
			const rows = await dataSource.query(
				`SELECT "appointmentId", "employeeAppointmentId", "tenantId", "organizationId" FROM "appointment_employee"`
			);
			expect(rows.map((row: Record<string, unknown>) => ({ ...row }))).toEqual([
				{ appointmentId: meeting.id, employeeAppointmentId: meeting.id, tenantId: TENANT, organizationId: ORGANIZATION },
				{ appointmentId: meeting.id, employeeAppointmentId: meeting.id, tenantId: TENANT, organizationId: ORGANIZATION }
			]);

			expect(await service.replaceInvitees(meeting, [second, third])).toEqual({
				added: [third],
				removed: [first],
				kept: [second]
			});
			expect((await service.inviteeIdsOf(meeting.id, TENANT)).sort()).toEqual([second, third].sort());
		});

		it('removes an invitee whose row names the meeting by the old key only', async () => {
			const meeting = await appointment(null);
			const invitee = await employee();
			await dataSource.query(
				`INSERT INTO "appointment_employee" ("id", "tenantId", "organizationId", "appointmentId", "employeeId") VALUES (?, ?, ?, ?, ?)`,
				[randomUUID(), TENANT, ORGANIZATION, meeting.id, invitee]
			);

			expect(await service.replaceInvitees(meeting, [])).toEqual({ added: [], removed: [invitee], kept: [] });
			expect(await service.inviteeIdsOf(meeting.id, TENANT)).toEqual([]);
		});
	});

	describe('notify', () => {
		it("tells each receiver, in their own time zone, but not the one who made the change", async () => {
			const host = await employee();
			const paris = await employee({ timeZone: 'Europe/Paris' });
			const newYork = await employee({ timeZone: 'America/New_York' });
			const meeting = await appointment(host);

			const filed = await service.notify('invited', meeting, [paris, newYork, host], { sentByEmployeeId: host, now: NOW });

			expect(filed).toBe(2);
			expect(notifications.create.mock.calls.map(([input]) => input)).toEqual([
				{
					title: 'You are invited to "Sprint review"',
					message: 'Thursday, November 12, 2026, 2:00 – 2:30 PM (Europe/Paris)',
					type: EmployeeNotificationTypeEnum.MEETING,
					entity: BaseEntityEnum.EmployeeAppointment,
					entityId: meeting.id,
					receiverEmployeeId: paris,
					sentByEmployeeId: host,
					organizationId: ORGANIZATION,
					tenantId: TENANT
				},
				expect.objectContaining({
					receiverEmployeeId: newYork,
					message: 'Thursday, November 12, 2026, 8:00 – 8:30 AM (America/New_York)'
				})
			]);
		});

		it('tells nothing about a meeting that ended already', async () => {
			const meeting = await appointment(null, { startsIn: -2 * 60 * MINUTE });

			expect(await service.notify('changed', meeting, [await employee()], { now: NOW })).toBe(0);
			expect(notifications.create).not.toHaveBeenCalled();
		});

		it("tells only the employees of the meeting's organization and tenant", async () => {
			const meeting = await appointment(null);
			const colleague = await employee();
			const elsewhere = await employee({ organizationId: OTHER_ORGANIZATION });
			const stranger = await employee({ tenantId: OTHER_TENANT });
			const gone = await employee({ deleted: true });

			expect(await service.notify('changed', meeting, [elsewhere, colleague, stranger, gone], { now: NOW })).toBe(1);
			expect(notifications.create.mock.calls.map(([input]) => input.receiverEmployeeId)).toEqual([colleague]);
		});

		it('files the others when one notice fails, and never throws', async () => {
			const meeting = await appointment(null);
			const [first, second] = [await employee(), await employee()];
			notifications.create.mockRejectedValueOnce(new Error('down'));

			expect(await service.notify('cancelled', meeting, [first, second], { now: NOW })).toBe(1);
			expect(notifications.create).toHaveBeenCalledTimes(2);
		});
	});

	describe('invitationsOf', () => {
		it("lists the meetings the employee is invited to, by start, with their host's name, and none they are not", async () => {
			const host = await employee({ name: ['Ruslan', 'K'] });
			const invitee = await employee();
			const later = await appointment(host, { startsIn: 3 * 60 * MINUTE, agenda: 'Planning' });
			const sooner = await appointment(host, { startsIn: 60 * MINUTE });
			await appointment(host, { startsIn: 2 * 60 * MINUTE, agenda: 'Not invited' });
			const cancelled = await appointment(host, { status: 'Cancelled', agenda: 'Cancelled' });
			for (const meeting of [later, sooner, cancelled]) {
				await service.replaceInvitees(meeting, [invitee]);
			}

			const invitations = await service.invitationsOf(invitee, TENANT, {}, NOW);

			expect(invitations.map((one) => one.agenda)).toEqual(['Sprint review', 'Planning']);
			expect(invitations[0]).toEqual({
				id: sooner.id,
				agenda: 'Sprint review',
				description: null,
				location: 'https://app.ever.team/meet/jitsi?room=U3ByaW50',
				startDateTime: sooner.startDateTime,
				endDateTime: sooner.endDateTime,
				status: null,
				organizationId: ORGANIZATION,
				host: { employeeId: host, name: 'Ruslan K' }
			});
		});

		it('keeps to the range asked, by overlap, and to the tenant', async () => {
			const invitee = await employee();
			const meeting = await appointment(null, { startsIn: 60 * MINUTE });
			await service.replaceInvitees(meeting, [invitee]);

			const range = (start: number, end: number) =>
				service.invitationsOf(invitee, TENANT, {
					startDate: new Date(NOW + start).toISOString(),
					endDate: new Date(NOW + end).toISOString()
				});
			expect(await range(70 * MINUTE, 80 * MINUTE)).toHaveLength(1);
			expect(await range(0, 60 * MINUTE)).toHaveLength(0);
			expect(await range(90 * MINUTE, 120 * MINUTE)).toHaveLength(0);
			expect(await service.invitationsOf(invitee, OTHER_TENANT, {}, NOW)).toEqual([]);
			await expect(service.invitationsOf(invitee, TENANT, { startDate: 'soon' })).rejects.toThrow(
				'startDate must be a date.'
			);
		});

		it('lists the meetings not over yet unless an earlier start is asked', async () => {
			const invitee = await employee();
			const past = await appointment(null, { startsIn: -3 * 60 * MINUTE, agenda: 'Retro' });
			const running = await appointment(null, { startsIn: -10 * MINUTE, agenda: 'Stand-up' });
			const next = await appointment(null, { startsIn: 60 * MINUTE, agenda: 'Planning' });
			for (const meeting of [past, running, next]) {
				await service.replaceInvitees(meeting, [invitee]);
			}

			expect((await service.invitationsOf(invitee, TENANT, {}, NOW)).map((one) => one.agenda)).toEqual([
				'Stand-up',
				'Planning'
			]);
			const fromYesterday = { startDate: new Date(NOW - 24 * 60 * MINUTE).toISOString() };
			expect((await service.invitationsOf(invitee, TENANT, fromYesterday, NOW)).map((one) => one.agenda)).toEqual([
				'Retro',
				'Stand-up',
				'Planning'
			]);
		});

		it('lists no meeting of another organization, whatever row names the invitee', async () => {
			const invitee = await employee();
			const ours = await appointment(null, { agenda: 'Ours' });
			const theirs = await appointment(null, { agenda: 'Theirs', organizationId: OTHER_ORGANIZATION });
			for (const meeting of [ours, theirs]) {
				await dataSource.query(
					`INSERT INTO "appointment_employee" ("id", "tenantId", "organizationId", "appointmentId", "employeeAppointmentId", "employeeId") VALUES (?, ?, ?, ?, ?, ?)`,
					[randomUUID(), TENANT, meeting.organizationId, meeting.id, meeting.id, invitee]
				);
			}

			expect((await service.invitationsOf(invitee, TENANT, {}, NOW)).map((one) => one.agenda)).toEqual(['Ours']);
		});
	});
});
