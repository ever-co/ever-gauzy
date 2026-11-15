// The dialect helpers read DB_TYPE once, when @gauzy/config loads: the entities map for the embedded database.
jest.mock('@gauzy/config', () => {
	process.env.DB_TYPE = 'better-sqlite3';
	return jest.requireActual('@gauzy/config');
});

import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import {
	ID,
	InvoiceScheduleFrequencyEnum,
	InvoiceScheduleGroupingEnum,
	InvoiceScheduleRunStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import {
	Invoice,
	InvoiceSchedule,
	InvoiceScheduleRun,
	Organization,
	OrganizationContact,
	Tenant,
	User
} from '../core/entities/internal';
import { INVOICE_SCHEDULE_CLIENT, INVOICE_SCHEDULE_EXISTS, InvoiceScheduleService } from './invoice-schedule.service';

/** Booting the whole entity graph on SQLite takes a while. */
const TIMEOUT = 600_000;

const TENANT = '16000000-0000-4000-8000-000000000001';
const ORGANIZATION = '16000000-0000-4000-8000-000000000002';
const OTHER_ORGANIZATION = '16000000-0000-4000-8000-000000000003';
const ADMIN = '16000000-0000-4000-8000-000000000020';
const OTHER_ADMIN = '16000000-0000-4000-8000-000000000021';
const ACME = '16000000-0000-4000-8000-000000000030';
const GLOBEX = '16000000-0000-4000-8000-000000000031';
const ELSEWHERE = '16000000-0000-4000-8000-000000000032';
const INVOICE = '16000000-0000-4000-8000-000000000040';

/** A value for a NOT NULL column without a default that a row leaves out. */
function placeholder(type: unknown): unknown {
	const name = typeof type === 'function' ? type.name.toLowerCase() : String(type).toLowerCase();
	if (/int|number|numeric|decimal|real|float|double/.test(name)) return 0;
	if (/bool/.test(name)) return false;
	if (/date|time/.test(name)) return new Date('2026-01-01T00:00:00Z');
	if (/json/.test(name)) return {};
	return 'x';
}

describe('InvoiceScheduleService on SQLite', () => {
	/** The request context a real request runs in: the base service keeps its bypasses there. */
	const cls = new ClsService(new AsyncLocalStorage());
	const originalClsService = RequestContext['clsService'];
	const inRequest = (work: () => Promise<void>) => () => cls.run(work);
	let dataSource: DataSource;
	let service: InvoiceScheduleService;

	/** Inserts a row with the columns given and a placeholder in every other NOT NULL column without a default. */
	async function insertRow(entity: EntityTarget<ObjectLiteral>, row: Record<string, unknown>): Promise<void> {
		const metadata = dataSource.getMetadata(entity);
		const values: Record<string, unknown> = { ...row };
		for (const column of metadata.columns) {
			const needsNoValue =
				column.isNullable ||
				column.default !== undefined ||
				column.isGenerated ||
				column.isCreateDate ||
				column.isUpdateDate ||
				column.isVirtual ||
				!!column.relationMetadata;
			if (column.propertyName in values || needsNoValue) continue;
			values[column.propertyName] = placeholder(column.type);
		}
		await dataSource.createQueryBuilder().insert().into(entity).values(values).execute();
	}

	/** Acts as a user of the organization who may edit its invoices. */
	function actAs(userId: ID): void {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(userId);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: userId, tenantId: TENANT } as never);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
		jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false);
	}

	/** Today is that moment, for `new Date()` only: the database's own timers keep running. */
	function todayIs(instant: string): void {
		jest.useFakeTimers({
			now: new Date(instant),
			doNotFake: [
				'nextTick',
				'setImmediate',
				'clearImmediate',
				'setTimeout',
				'clearTimeout',
				'setInterval',
				'clearInterval',
				'queueMicrotask',
				'hrtime',
				'performance'
			]
		});
	}

	async function monthlyFor(organizationContactId: ID, startDay = '2026-10-01') {
		return await service.createSchedule({
			organizationId: ORGANIZATION,
			organizationContactId,
			frequency: InvoiceScheduleFrequencyEnum.MONTHLY,
			startDay
		} as never);
	}

	beforeAll(async () => {
		RequestContext.setClsService(cls);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		const { coreEntities } = require('../core/entities');
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			synchronize: true,
			entities: coreEntities,
			logging: false
		});
		await dataSource.initialize();

		await insertRow(Tenant, { id: TENANT, name: 'Tenant' });
		// UTC+1 all year: a day there starts an hour before it does in UTC
		await insertRow(Organization, { id: ORGANIZATION, tenantId: TENANT, name: 'Studio', timeZone: 'Africa/Lagos' });
		await insertRow(Organization, { id: OTHER_ORGANIZATION, tenantId: TENANT, name: 'Labs' });
		for (const id of [ADMIN, OTHER_ADMIN]) {
			await insertRow(User, { id, tenantId: TENANT, email: `${id.slice(-2)}@studio.test` });
		}
		await insertRow(OrganizationContact, {
			id: ACME,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			name: 'Acme'
		});
		await insertRow(OrganizationContact, {
			id: GLOBEX,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			name: 'Globex'
		});
		await insertRow(OrganizationContact, {
			id: ELSEWHERE,
			tenantId: TENANT,
			organizationId: OTHER_ORGANIZATION,
			name: 'Elsewhere'
		});
		await insertRow(Invoice, {
			id: INVOICE,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			fromOrganizationId: ORGANIZATION,
			invoiceNumber: 7,
			dueDate: new Date('2026-12-01T00:00:00Z'),
			currency: 'USD',
			status: 'DRAFT',
			totalValue: 1200
		});

		service = new InvoiceScheduleService(
			dataSource.getRepository(InvoiceSchedule) as never,
			{} as never,
			dataSource
		);
	}, TIMEOUT);

	afterAll(async () => {
		RequestContext.setClsService(originalClsService);
		jest.useRealTimers();
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
	});

	beforeEach(async () => {
		await dataSource.query('DELETE FROM "invoice_schedule_run"');
		await dataSource.query('DELETE FROM "invoice_schedule"');
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it(
		"sets Acme's monthly schedule as a draft by project, run by its author from now, with October next",
		inRequest(async () => {
			actAs(ADMIN);
			todayIs('2026-10-20T09:00:00Z');

			const schedule = await monthlyFor(ACME);

			expect(schedule).toMatchObject({
				organizationContactId: ACME,
				frequency: InvoiceScheduleFrequencyEnum.MONTHLY,
				startDay: '2026-10-01',
				grouping: InvoiceScheduleGroupingEnum.PROJECT,
				sendInvoice: false,
				pausedAt: null,
				authorId: ADMIN,
				lastRun: null,
				nextPeriod: { startDay: '2026-10-01', endDay: '2026-10-31', runDay: '2026-11-01' }
			});
			expect(schedule.activeSince).toBeTruthy();
			expect(schedule.organizationContact?.name).toBe('Acme');
		}),
		TIMEOUT
	);

	it(
		"counts today in the organization's zone: 23:30 UTC on 31 October is already 1 November in Lagos",
		inRequest(async () => {
			actAs(ADMIN);
			todayIs('2026-10-31T23:30:00Z');

			const schedule = await monthlyFor(ACME);

			// Created on its run day, there: October is billed today
			expect(schedule.nextPeriod).toEqual({ startDay: '2026-10-01', endDay: '2026-10-31', runDay: '2026-11-01' });
		}),
		TIMEOUT
	);

	it(
		'never bills the past: a schedule created after a run day starts with the period ahead',
		inRequest(async () => {
			actAs(ADMIN);
			todayIs('2026-11-02T09:00:00Z');

			const schedule = await monthlyFor(ACME);

			expect(schedule.nextPeriod).toEqual({ startDay: '2026-11-01', endDay: '2026-11-30', runDay: '2026-12-01' });
		}),
		TIMEOUT
	);

	it(
		'refuses a second schedule for a client, a client of another organization, and a start day that does not exist',
		inRequest(async () => {
			actAs(ADMIN);
			await monthlyFor(ACME);

			await expect(monthlyFor(ACME)).rejects.toThrow(new ConflictException(INVOICE_SCHEDULE_EXISTS));
			await expect(monthlyFor(ELSEWHERE)).rejects.toThrow(new BadRequestException(INVOICE_SCHEDULE_CLIENT));
			await expect(monthlyFor(GLOBEX, '2026-02-30')).rejects.toThrow(BadRequestException);
			expect(await dataSource.getRepository(InvoiceSchedule).count()).toBe(1);
		}),
		TIMEOUT
	);

	it(
		'pauses a schedule, which then has no next period, and resumes it from today: the periods it skipped are not billed',
		inRequest(async () => {
			actAs(ADMIN);
			todayIs('2026-10-20T09:00:00Z');
			const schedule = await monthlyFor(ACME);

			todayIs('2026-10-25T09:00:00Z');
			const paused = await service.updateSchedule(schedule.id, {
				organizationId: ORGANIZATION,
				paused: true
			} as never);
			expect(paused.pausedAt).toBeTruthy();
			expect(paused.nextPeriod).toBeNull();

			// Resumed on 3 November, after October's run day: November comes next, October is skipped
			actAs(OTHER_ADMIN);
			todayIs('2026-11-03T09:00:00Z');
			const resumed = await service.updateSchedule(schedule.id, {
				organizationId: ORGANIZATION,
				paused: false,
				sendInvoice: true
			} as never);
			expect(resumed).toMatchObject({
				pausedAt: null,
				sendInvoice: true,
				// Whoever saves the schedule takes it over
				authorId: OTHER_ADMIN,
				nextPeriod: { startDay: '2026-11-01', runDay: '2026-12-01' }
			});
			// SQLite hands a timestamp back in the server's zone: compared with the one before, not with a fixed instant
			expect(new Date(resumed.activeSince).getTime()).toBeGreaterThan(new Date(paused.activeSince).getTime());
		}),
		TIMEOUT
	);

	it(
		'answers the latest run with its invoice, and the next period after a period it billed, but not after one that failed',
		inRequest(async () => {
			actAs(ADMIN);
			todayIs('2026-10-20T09:00:00Z');
			const schedule = await monthlyFor(ACME);
			const runs = dataSource.getRepository(InvoiceScheduleRun);
			const scope = { tenantId: TENANT, organizationId: ORGANIZATION, invoiceScheduleId: schedule.id };

			todayIs('2026-11-01T10:00:00Z');
			await runs.insert({
				...scope,
				periodStart: '2026-10-01',
				periodEnd: '2026-10-31',
				status: InvoiceScheduleRunStatusEnum.FAILED,
				claimedAt: new Date('2026-11-01T00:05:00Z')
			} as never);
			expect((await service.findOneInOrganization(schedule.id, ORGANIZATION)).nextPeriod).toMatchObject({
				startDay: '2026-10-01'
			});

			await runs.update(
				{ invoiceScheduleId: schedule.id },
				{ status: InvoiceScheduleRunStatusEnum.DRAFTED, invoiceId: INVOICE, finishedAt: new Date() }
			);
			const read = await service.findOneInOrganization(schedule.id, ORGANIZATION);
			expect(read.nextPeriod).toMatchObject({ startDay: '2026-11-01', runDay: '2026-12-01' });
			expect(read.lastRun).toMatchObject({
				periodStart: '2026-10-01',
				status: InvoiceScheduleRunStatusEnum.DRAFTED,
				invoice: { id: INVOICE, invoiceNumber: 7, status: 'DRAFT', currency: 'USD' }
			});

			const listed = await service.runsOf(schedule.id, ORGANIZATION);
			expect(listed.map((run) => run.periodStart)).toEqual(['2026-10-01']);
		}),
		TIMEOUT
	);

	it(
		"lists an organization's schedules, or one client's, and answers 404 for another organization's",
		inRequest(async () => {
			actAs(ADMIN);
			const acme = await monthlyFor(ACME);
			await monthlyFor(GLOBEX);

			expect(
				(await service.list({ organizationId: ORGANIZATION } as never)).map((it) => it.organizationContactId)
			).toEqual([ACME, GLOBEX]);
			expect(
				(await service.list({ organizationId: ORGANIZATION, organizationContactId: GLOBEX } as never)).map(
					(it) => it.organizationContactId
				)
			).toEqual([GLOBEX]);
			expect(await service.list({ organizationId: OTHER_ORGANIZATION } as never)).toEqual([]);

			await expect(service.findOneInOrganization(acme.id, OTHER_ORGANIZATION)).rejects.toThrow(NotFoundException);
			await expect(
				service.updateSchedule(acme.id, { organizationId: OTHER_ORGANIZATION, paused: true } as never)
			).rejects.toThrow(NotFoundException);
			await expect(service.deleteSchedule(acme.id, OTHER_ORGANIZATION)).rejects.toThrow(NotFoundException);
		}),
		TIMEOUT
	);

	it(
		'deletes a schedule with its runs, and keeps the invoices they made',
		inRequest(async () => {
			actAs(ADMIN);
			const schedule = await monthlyFor(ACME);
			await dataSource.getRepository(InvoiceScheduleRun).insert({
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				invoiceScheduleId: schedule.id,
				periodStart: '2026-10-01',
				periodEnd: '2026-10-31',
				status: InvoiceScheduleRunStatusEnum.DRAFTED,
				claimedAt: new Date(),
				invoiceId: INVOICE
			} as never);

			await service.deleteSchedule(schedule.id, ORGANIZATION);

			expect(await dataSource.getRepository(InvoiceSchedule).count()).toBe(0);
			expect(await dataSource.getRepository(InvoiceScheduleRun).count()).toBe(0);
			expect(await dataSource.getRepository(Invoice).countBy({ id: INVOICE })).toBe(1);
		}),
		TIMEOUT
	);
});
