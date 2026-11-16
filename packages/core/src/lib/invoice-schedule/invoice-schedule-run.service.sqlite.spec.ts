// The dialect helpers read DB_TYPE once, when @gauzy/config loads: the entities map for the embedded database.
jest.mock('@gauzy/config', () => {
	process.env.DB_TYPE = 'better-sqlite3';
	return jest.requireActual('@gauzy/config');
});

import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { ClsService } from 'nestjs-cls';
import { Brackets, DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import {
	ID,
	InvoiceScheduleFrequencyEnum,
	InvoiceScheduleGroupingEnum,
	InvoiceScheduleRunReasonEnum,
	InvoiceScheduleRunStatusEnum,
	PermissionsEnum,
	TimeLogType
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import {
	Employee,
	EstimateEmail,
	Invoice,
	InvoiceItem,
	InvoiceSchedule,
	InvoiceScheduleRun,
	Organization,
	OrganizationContact,
	OrganizationProject,
	OrganizationProjectEmployee,
	Task,
	Tenant,
	TimeLog,
	User,
	UserOrganization
} from '../core/entities/internal';
import { NOT_ON_LIVE_INVOICE_PARAMETERS, notOnLiveInvoice } from '../invoice-item/invoice-item-billed-time';
import { InvoiceService } from '../invoice/invoice.service';
import { InvoiceScheduleRunService, scheduledInvoiceIdOf } from './invoice-schedule-run.service';

/** An instant as the time read hands it to SQLite (`getDateRangeFormat`): in UTC, to the second. */
function sqliteSecondOf(instant: Date): string {
	return new Date(instant).toISOString().slice(0, 19).replace('T', ' ');
}

/** Booting the whole entity graph on SQLite takes a while. */
const TIMEOUT = 600_000;
const HOUR = 3600;

const TENANT = '17000000-0000-4000-8000-000000000001';
const ORGANIZATION = '17000000-0000-4000-8000-000000000002';
const ADMIN = '17000000-0000-4000-8000-000000000010';
const MARIE = '17000000-0000-4000-8000-000000000020';
const PAUL = '17000000-0000-4000-8000-000000000021';
const MARIE_USER = '17000000-0000-4000-8000-000000000022';
const PAUL_USER = '17000000-0000-4000-8000-000000000023';
const ACME = '17000000-0000-4000-8000-000000000030';
const GLOBEX = '17000000-0000-4000-8000-000000000031';
const WEBSITE = '17000000-0000-4000-8000-000000000040';
const APP = '17000000-0000-4000-8000-000000000041';
const GLOBEX_PORTAL = '17000000-0000-4000-8000-000000000042';
const DESIGN_TASK = '17000000-0000-4000-8000-000000000050';
const SCHEDULE = '17000000-0000-4000-8000-000000000060';

/** What the author may do: an admin of the organization. */
const ADMIN_PERMISSIONS = [
	PermissionsEnum.INVOICES_EDIT,
	PermissionsEnum.INVOICES_VIEW,
	PermissionsEnum.ALL_ORG_VIEW,
	PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
];

/** A value for a NOT NULL column without a default that a row leaves out. */
function placeholder(type: unknown): unknown {
	const name = typeof type === 'function' ? type.name.toLowerCase() : String(type).toLowerCase();
	if (/int|number|numeric|decimal|real|float|double/.test(name)) return 0;
	if (/bool/.test(name)) return false;
	if (/date|time/.test(name)) return new Date('2026-01-01T00:00:00Z');
	if (/json/.test(name)) return {};
	return 'x';
}

describe('InvoiceScheduleRunService on SQLite', () => {
	/** The request context a real request runs in: the run opens the author's own in it. */
	const cls = new ClsService(new AsyncLocalStorage());
	const originalClsService = RequestContext['clsService'];
	let dataSource: DataSource;
	let invoices: InvoiceService;
	let service: InvoiceScheduleRunService;
	let authorPermissions: PermissionsEnum[] = ADMIN_PERMISSIONS;
	let sentEmails: Array<{ email: string; invoiceId: ID }>;
	let sendSucceeds = true;
	let logCount = 0;
	/** What happens elsewhere while a run reads its time, when a case says. */
	let duringTimeRead: (() => Promise<void>) | null = null;

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

	/** A billable time log of a member, from a local time in Lagos (UTC+1) and for a number of hours. */
	async function track(
		employeeId: ID,
		date: string,
		time: string,
		hours: number,
		options: {
			projectId?: ID;
			taskId?: ID | null;
			isBillable?: boolean;
			running?: boolean;
			/** The rates the log keeps, as the API records them with it. */
			kept?: Partial<Pick<TimeLog, 'billRateValue' | 'billRateCurrency' | 'projectBillRateValue'>>;
		} = {}
	): Promise<ID> {
		const startedAt = new Date(`${date}T${time}:00+01:00`);
		const stoppedAt = options.running ? null : new Date(startedAt.getTime() + hours * HOUR * 1000);
		logCount++;
		const id = `17000000-0000-4000-9000-${String(logCount).padStart(12, '0')}`;
		await insertRow(TimeLog, {
			id,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			employeeId,
			startedAt,
			stoppedAt,
			isRunning: options.running === true,
			isBillable: options.isBillable ?? true,
			logType: TimeLogType.TRACKED,
			projectId: options.projectId ?? WEBSITE,
			taskId: options.taskId ?? null,
			...(options.kept
				? {
						ratesStored: true,
						billRateCurrency: 'USD',
						projectBillRateCurrency: 'USD',
						projectMemberBillRateCurrency: 'USD',
						...options.kept
					}
				: {})
		});
		return id;
	}

	/** Acme's schedule, monthly from 1 October, created before its first run day. */
	async function schedule(changes: Partial<InvoiceSchedule> = {}): Promise<void> {
		await dataSource.getRepository(InvoiceSchedule).insert({
			id: SCHEDULE,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			organizationContactId: ACME,
			frequency: InvoiceScheduleFrequencyEnum.MONTHLY,
			startDay: '2026-10-01',
			grouping: InvoiceScheduleGroupingEnum.PROJECT,
			sendInvoice: false,
			activeSince: new Date('2026-10-15T09:00:00Z'),
			authorId: ADMIN,
			...changes
		} as never);
	}

	const runs = () => dataSource.getRepository(InvoiceScheduleRun).find({ order: { claimedAt: 'ASC' } });
	const madeInvoices = () =>
		dataSource
			.getRepository(Invoice)
			.find({ where: { organizationContactId: ACME }, relations: { invoiceItems: true } });
	const billedLogIds = async () =>
		(await dataSource.getRepository(TimeLog).find({ select: { id: true, invoiceItemId: true } }))
			.filter((log) => !!log.invoiceItemId)
			.map((log) => log.id)
			.sort();

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
		await insertRow(Organization, {
			id: ORGANIZATION,
			tenantId: TENANT,
			name: 'Studio',
			timeZone: 'Africa/Lagos',
			currency: 'USD'
		});
		await insertRow(User, { id: ADMIN, tenantId: TENANT, email: 'admin@studio.test', isActive: true });
		await insertRow(UserOrganization, {
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			userId: ADMIN,
			isActive: true,
			isArchived: false
		});
		for (const [id, userId, firstName, billRateValue] of [
			[MARIE, MARIE_USER, 'Marie', 80],
			[PAUL, PAUL_USER, 'Paul', 0]
		] as const) {
			await insertRow(User, { id: userId, tenantId: TENANT, firstName, lastName: 'Studio' });
			await insertRow(Employee, {
				id,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				userId,
				billRateValue,
				billRateCurrency: 'USD'
			});
		}
		await insertRow(OrganizationContact, {
			id: ACME,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			name: 'Acme',
			primaryEmail: 'billing@acme.test'
		});
		await insertRow(OrganizationContact, {
			id: GLOBEX,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			name: 'Globex'
		});
		await insertRow(OrganizationProject, {
			id: WEBSITE,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			organizationContactId: ACME,
			name: 'Website',
			billRateValue: 100
		});
		await insertRow(OrganizationProject, {
			id: APP,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			organizationContactId: ACME,
			name: 'App'
		});
		await insertRow(OrganizationProject, {
			id: GLOBEX_PORTAL,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			organizationContactId: GLOBEX,
			name: 'Portal',
			billRateValue: 100
		});
		// Paul has no rate of his own, and a client rate on App
		await insertRow(OrganizationProjectEmployee, {
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			organizationProjectId: APP,
			employeeId: PAUL,
			billRateValue: 60,
			isActive: true,
			isArchived: false
		});
		await insertRow(Task, {
			id: DESIGN_TASK,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			title: 'Design',
			number: 7
		});

		const highestNumbered = { id: '17000000-0000-4000-8000-0000000000ff', invoiceNumber: 41 };
		await insertRow(Invoice, {
			...highestNumbered,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			fromOrganizationId: ORGANIZATION,
			organizationContactId: GLOBEX,
			dueDate: new Date('2026-09-30T00:00:00Z'),
			currency: 'USD',
			status: 'SENT'
		});

		invoices = new InvoiceService(
			dataSource.getRepository(Invoice) as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never
		);
		jest.spyOn(invoices, 'sendEmail').mockImplementation(async (_language, email, _number, invoiceId) => {
			sentEmails.push({ email, invoiceId });
			return sendSucceeds ? { sent: true } : { sent: false, reason: 'EMAIL_NOT_SENT' };
		});

		// The time the invoices page reads: billable logs of the projects named, started in the range, not on a live invoice
		const timeLogs = {
			getTimeLogs: async (request: {
				tenantId: ID;
				organizationId: ID;
				projectIds: ID[];
				startDate: Date;
				endDate: Date;
				billableOnly?: boolean;
				notInvoiced?: boolean;
			}) => {
				expect(RequestContext.currentUser()?.id).toBe(ADMIN);
				await duringTimeRead?.();
				const query = dataSource
					.getRepository(TimeLog)
					.createQueryBuilder('time_log')
					.where({ tenantId: request.tenantId, organizationId: request.organizationId })
					.andWhere('"time_log"."projectId" IN (:...projectIds)', { projectIds: request.projectIds })
					.andWhere(
						new Brackets((qb) => {
							qb.where('"time_log"."startedAt" >= :start', { start: sqliteSecondOf(request.startDate) });
							qb.andWhere('"time_log"."startedAt" < :end', { end: sqliteSecondOf(request.endDate) });
						})
					)
					.andWhere('"time_log"."logType" <> :breakType', { breakType: TimeLogType.BREAK });
				if (request.billableOnly) {
					query.andWhere('"time_log"."isBillable" = :isBillable', { isBillable: true });
				}
				if (request.notInvoiced) {
					query.andWhere(notOnLiveInvoice('"time_log"."invoiceItemId"'), NOT_ON_LIVE_INVOICE_PARAMETERS);
				}
				return await query.getMany();
			}
		};
		const users = {
			getIfExists: async (id: ID) =>
				await dataSource
					.getRepository(User)
					.findOne({ where: { id }, select: { id: true, tenantId: true } })
					.then(
						(user) =>
							user && {
								...user,
								isActive: true,
								isArchived: false,
								preferredLanguage: 'fr'
							}
					)
		};
		const roles = {
			attachAuthorizationState: async (user: unknown) => user
		};
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
			authorPermissions.includes(permission as PermissionsEnum)
		);
		jest.spyOn(RequestContext, 'hasAnyPermission').mockImplementation((permissions) =>
			permissions.some((permission) => authorPermissions.includes(permission as PermissionsEnum))
		);
		service = new InvoiceScheduleRunService(
			dataSource,
			users as never,
			roles as never,
			timeLogs as never,
			invoices
		);
	}, TIMEOUT);

	afterAll(async () => {
		RequestContext.setClsService(originalClsService);
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
	});

	beforeEach(async () => {
		authorPermissions = ADMIN_PERMISSIONS;
		sentEmails = [];
		sendSucceeds = true;
		duringTimeRead = null;
		await dataSource.query('DELETE FROM "estimate_email"');
		await dataSource.query('DELETE FROM "invoice_schedule_run"');
		await dataSource.query('DELETE FROM "invoice_schedule"');
		await dataSource.query('UPDATE "time_log" SET "invoiceItemId" = NULL');
		await dataSource.query('DELETE FROM "invoice_item"');
		await dataSource.query(`DELETE FROM "invoice" WHERE "invoiceNumber" <> 41`);
		await dataSource.query('DELETE FROM "time_log"');
	});

	it(
		"makes Acme's October invoice on 1 November, with October's lines priced as a manual invoice",
		async () => {
			await schedule();
			const website = await track(MARIE, '2026-10-05', '09:00', 3);
			const app = await track(PAUL, '2026-10-20', '14:00', 2, { projectId: APP });
			// Not October's, not billable, another client's
			await track(MARIE, '2026-11-01', '00:30', 1);
			await track(MARIE, '2026-10-06', '09:00', 4, { isBillable: false });
			await track(MARIE, '2026-10-07', '09:00', 5, { projectId: GLOBEX_PORTAL });

			// 1 November, 07:00 in Lagos
			const report = await service.sweep(new Date('2026-11-01T06:00:00Z'));

			expect(report).toMatchObject({ checked: 1, invoiced: 1, sent: 0, failed: 0 });
			const [invoice] = await madeInvoices();
			expect(invoice).toMatchObject({
				invoiceNumber: 42,
				status: 'DRAFT',
				currency: 'USD',
				terms: 'Billable time from 2026-10-01 to 2026-10-31',
				organizationContactId: ACME,
				toContactId: ACME,
				isEstimate: false
			});
			// Issued on 1 November and due 30 days later, in Lagos
			expect(new Date(invoice.invoiceDate).toISOString()).toBe('2026-10-31T23:00:00.000Z');
			expect(new Date(invoice.dueDate).toISOString()).toBe('2026-12-01T22:59:59.999Z');
			// Marie at the Website's client rate (3 h at 100), Paul at his client rate on App (2 h at 60)
			const lines = invoice.invoiceItems
				.map(({ description, quantity, price, totalValue }) => ({
					description,
					quantity: Number(quantity),
					price: Number(price),
					totalValue: Number(totalValue)
				}))
				.sort((first, second) => first.description.localeCompare(second.description));
			expect(lines).toEqual([
				{ description: 'App', quantity: 2, price: 60, totalValue: 120 },
				{ description: 'Website', quantity: 3, price: 100, totalValue: 300 }
			]);
			expect(Number(invoice.totalValue)).toBe(420);
			expect(await billedLogIds()).toEqual([website, app].sort());

			const [run] = await runs();
			expect(run).toMatchObject({
				periodStart: '2026-10-01',
				periodEnd: '2026-10-31',
				status: InvoiceScheduleRunStatusEnum.DRAFTED,
				reason: null,
				invoiceId: invoice.id,
				leftOutSeconds: null
			});
		},
		TIMEOUT
	);

	it(
		'bills each log at the client rate it keeps: a rate raised "from now on" leaves earlier time at its price',
		async () => {
			await schedule({ grouping: InvoiceScheduleGroupingEnum.MEMBER });
			// The Website's client rate was 90 until it went to 100 "from now on" on 28 October
			const before = await track(MARIE, '2026-10-05', '09:00', 3, {
				kept: { projectBillRateValue: 90, billRateValue: 80 }
			});
			const after = await track(MARIE, '2026-10-28', '09:00', 2, {
				kept: { projectBillRateValue: 100, billRateValue: 80 }
			});
			// Recorded around the API, it keeps no rate: today's client rate prices it, as before
			const keepsNone = await track(MARIE, '2026-10-29', '09:00', 1);

			await service.sweep(new Date('2026-11-01T06:00:00Z'));

			const [invoice] = await madeInvoices();
			const billedBy = await dataSource
				.getRepository(TimeLog)
				.find({ select: { id: true, invoiceItemId: true } as never });
			const lines = invoice.invoiceItems
				.map(({ id, description, quantity, price, totalValue }) => ({
					description,
					quantity: Number(quantity),
					price: Number(price),
					totalValue: Number(totalValue),
					timeLogIds: billedBy
						.filter((log) => log.invoiceItemId === id)
						.map((log) => log.id)
						.sort()
				}))
				.sort((first, second) => first.price - second.price);
			expect(lines).toEqual([
				{
					description: 'Website · Marie Studio',
					quantity: 3,
					price: 90,
					totalValue: 270,
					timeLogIds: [before]
				},
				{
					description: 'Website · Marie Studio',
					quantity: 3,
					price: 100,
					totalValue: 300,
					timeLogIds: [after, keepsNone].sort()
				}
			]);
			expect(Number(invoice.totalValue)).toBe(570);
		},
		TIMEOUT
	);

	it(
		'bills a log that keeps no client rate at the billing rate it keeps, not at the member rate of today',
		async () => {
			await schedule();
			// Marie's own rate is 80 today; her log on App, which has no client rate, kept 70
			await track(MARIE, '2026-10-05', '09:00', 2, { projectId: APP, kept: { billRateValue: 70 } });

			await service.sweep(new Date('2026-11-01T06:00:00Z'));

			const [invoice] = await madeInvoices();
			expect(invoice.invoiceItems.map(({ quantity, price }) => [Number(quantity), Number(price)])).toEqual([
				[2, 70]
			]);
		},
		TIMEOUT
	);

	it(
		'bills a period once: a second sweep, or two processes sweeping at the same moment, make nothing more',
		async () => {
			await schedule();
			await track(MARIE, '2026-10-05', '09:00', 3);
			const now = new Date('2026-11-01T06:00:00Z');

			const [first, second] = await Promise.all([service.sweep(now), service.sweep(now)]);
			const later = await service.sweep(new Date('2026-11-01T09:00:00Z'));

			expect(first.invoiced + second.invoiced + later.invoiced).toBe(1);
			expect(await madeInvoices()).toHaveLength(1);
			expect(await runs()).toHaveLength(1);
		},
		TIMEOUT
	);

	it(
		'never bills time already on another invoice, and the run says when a month has nothing left to bill',
		async () => {
			await schedule();
			const billed = await track(MARIE, '2026-10-05', '09:00', 3);
			await dataSource.getRepository(InvoiceItem).insert({
				id: '17000000-0000-4000-8000-0000000000e1',
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				invoiceId: '17000000-0000-4000-8000-0000000000ff',
				description: 'October, by hand',
				price: 100,
				quantity: 3,
				totalValue: 300
			} as never);
			await dataSource
				.getRepository(TimeLog)
				.update({ id: billed }, { invoiceItemId: '17000000-0000-4000-8000-0000000000e1' } as never);

			const report = await service.sweep(new Date('2026-11-01T06:00:00Z'));

			expect(report).toMatchObject({ invoiced: 0, empty: 1 });
			expect(await madeInvoices()).toEqual([]);
			expect(await runs()).toMatchObject([
				{
					status: InvoiceScheduleRunStatusEnum.NO_TIME,
					reason: InvoiceScheduleRunReasonEnum.NO_BILLABLE_TIME,
					invoiceId: null
				}
			]);
		},
		TIMEOUT
	);

	it(
		'with Send on, emails the client and marks the invoice Sent; without an address, keeps the draft and says why',
		async () => {
			await schedule({ sendInvoice: true });
			await track(MARIE, '2026-10-05', '09:00', 3);

			await service.sweep(new Date('2026-11-01T06:00:00Z'));

			const [invoice] = await madeInvoices();
			expect(invoice.status).toBe('SENT');
			expect(sentEmails).toEqual([{ email: 'billing@acme.test', invoiceId: invoice.id }]);
			expect((await runs())[0]).toMatchObject({
				status: InvoiceScheduleRunStatusEnum.SENT,
				invoiceId: invoice.id
			});

			// November, to a client without an address
			await dataSource.getRepository(OrganizationContact).update({ id: ACME }, { primaryEmail: null });
			await track(MARIE, '2026-11-05', '09:00', 1);
			try {
				await service.sweep(new Date('2026-12-01T06:00:00Z'));
			} finally {
				await dataSource
					.getRepository(OrganizationContact)
					.update({ id: ACME }, { primaryEmail: 'billing@acme.test' });
			}
			const november = (await runs())[1];
			expect(november).toMatchObject({
				periodStart: '2026-11-01',
				status: InvoiceScheduleRunStatusEnum.NOT_SENT,
				reason: InvoiceScheduleRunReasonEnum.CLIENT_HAS_NO_EMAIL
			});
			const draft = (await madeInvoices()).find(({ id }) => id === november.invoiceId);
			expect(draft.status).toBe('DRAFT');
			expect(sentEmails).toHaveLength(1);
		},
		TIMEOUT
	);

	it(
		'keeps the invoice as a draft when its email fails, and says so',
		async () => {
			await schedule({ sendInvoice: true });
			await track(MARIE, '2026-10-05', '09:00', 3);
			sendSucceeds = false;

			const report = await service.sweep(new Date('2026-11-01T06:00:00Z'));

			expect(report).toMatchObject({ invoiced: 1, sent: 0, failed: 1 });
			expect((await madeInvoices())[0].status).toBe('DRAFT');
			expect((await runs())[0]).toMatchObject({
				status: InvoiceScheduleRunStatusEnum.NOT_SENT,
				reason: InvoiceScheduleRunReasonEnum.EMAIL_NOT_SENT
			});
		},
		TIMEOUT
	);

	it(
		'makes nothing as an author who can no longer make invoices, and tries again an hour later once they can',
		async () => {
			await schedule();
			await track(MARIE, '2026-10-05', '09:00', 3);
			authorPermissions = [PermissionsEnum.INVOICES_VIEW, PermissionsEnum.ALL_ORG_VIEW];

			await service.sweep(new Date('2026-11-01T06:00:00Z'));

			expect(await madeInvoices()).toEqual([]);
			expect(await runs()).toMatchObject([
				{
					status: InvoiceScheduleRunStatusEnum.FAILED,
					reason: InvoiceScheduleRunReasonEnum.AUTHOR_CANNOT_INVOICE
				}
			]);

			authorPermissions = ADMIN_PERMISSIONS;
			// Too soon: the failure waits for the next hourly sweep
			await service.sweep(new Date('2026-11-01T06:30:00Z'));
			expect(await madeInvoices()).toEqual([]);

			await service.sweep(new Date('2026-11-01T07:00:00Z'));
			expect(await madeInvoices()).toHaveLength(1);
			expect(await runs()).toMatchObject([{ status: InvoiceScheduleRunStatusEnum.DRAFTED, reason: null }]);
		},
		TIMEOUT
	);

	it(
		'makes nothing for an author who left the organization, or a schedule without an author',
		async () => {
			await schedule({ authorId: null });
			await track(MARIE, '2026-10-05', '09:00', 3);

			await service.sweep(new Date('2026-11-01T06:00:00Z'));

			expect(await madeInvoices()).toEqual([]);
			expect((await runs())[0]).toMatchObject({ reason: InvoiceScheduleRunReasonEnum.AUTHOR_CANNOT_INVOICE });
		},
		TIMEOUT
	);

	it(
		'leaves the time without any rate out of the invoice, and counts it on the run',
		async () => {
			await schedule({ grouping: InvoiceScheduleGroupingEnum.TASK });
			await track(MARIE, '2026-10-05', '09:00', 3, { taskId: DESIGN_TASK });
			// Paul has no rate on the Website: no client rate there, and none of his own
			await dataSource.getRepository(OrganizationProject).update({ id: WEBSITE }, { billRateValue: null });
			try {
				await track(PAUL, '2026-10-06', '09:00', 2);
				await service.sweep(new Date('2026-11-01T06:00:00Z'));
			} finally {
				await dataSource.getRepository(OrganizationProject).update({ id: WEBSITE }, { billRateValue: 100 });
			}

			const [invoice] = await madeInvoices();
			// Marie at her own rate, by task
			expect(
				invoice.invoiceItems.map(({ description, quantity, price }) => [
					description,
					Number(quantity),
					Number(price)
				])
			).toEqual([['Website · #7 Design · Marie Studio', 3, 80]]);
			expect((await runs())[0]).toMatchObject({
				status: InvoiceScheduleRunStatusEnum.DRAFTED,
				reason: InvoiceScheduleRunReasonEnum.TIME_LEFT_OUT,
				leftOutSeconds: 2 * HOUR
			});
		},
		TIMEOUT
	);

	it(
		'makes nothing for a paused schedule, nor for a period whose run day came before the schedule ran',
		async () => {
			await track(MARIE, '2026-10-05', '09:00', 3);
			await schedule({ pausedAt: new Date('2026-10-20T09:00:00Z') });

			expect(await service.sweep(new Date('2026-11-01T06:00:00Z'))).toMatchObject({ checked: 0 });

			await dataSource
				.getRepository(InvoiceSchedule)
				.update({ id: SCHEDULE }, { pausedAt: null, activeSince: new Date('2026-11-03T09:00:00Z') });
			expect(await service.sweep(new Date('2026-11-03T10:00:00Z'))).toMatchObject({ checked: 1, invoiced: 0 });
			expect(await runs()).toEqual([]);
		},
		TIMEOUT
	);

	it(
		'records the invoice a stopped process made before it could record it, instead of making a second one',
		async () => {
			await schedule();
			await track(MARIE, '2026-10-05', '09:00', 3);
			await service.sweep(new Date('2026-11-01T06:00:00Z'));
			const [invoice] = await madeInvoices();
			// As if the process had stopped right after saving the invoice
			await dataSource
				.getRepository(InvoiceScheduleRun)
				.update(
					{ invoiceScheduleId: SCHEDULE },
					{ status: InvoiceScheduleRunStatusEnum.CLAIMED, invoiceId: null }
				);

			await service.sweep(new Date('2026-11-01T07:30:00Z'));

			expect(await madeInvoices()).toHaveLength(1);
			expect(await runs()).toMatchObject([
				{ status: InvoiceScheduleRunStatusEnum.DRAFTED, invoiceId: invoice.id }
			]);
		},
		TIMEOUT
	);
	it(
		'bills a log started in the last second of the period',
		async () => {
			await schedule();
			const lastSecond = await track(MARIE, '2026-10-31', '23:59', 1);
			await dataSource
				.getRepository(TimeLog)
				.update({ id: lastSecond }, { startedAt: new Date('2026-10-31T23:59:59+01:00') });

			await service.sweep(new Date('2026-11-01T06:00:00Z'));

			expect(await billedLogIds()).toEqual([lastSecond]);
		},
		TIMEOUT
	);

	it(
		'gives the invoice of a period the same id each time, so a second save of the period can only meet the first',
		async () => {
			await schedule();
			await track(MARIE, '2026-10-05', '09:00', 3);

			await service.sweep(new Date('2026-11-01T06:00:00Z'));

			const [invoice] = await madeInvoices();
			expect(invoice.id).toBe(scheduledInvoiceIdOf(SCHEDULE, '2026-10-01'));
			expect(scheduledInvoiceIdOf(SCHEDULE, '2026-11-01')).not.toBe(invoice.id);
			expect(invoice.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		},
		TIMEOUT
	);

	it(
		'sends the draft a stopped process saved and did not send, an hour later',
		async () => {
			await schedule({ sendInvoice: true });
			await track(MARIE, '2026-10-05', '09:00', 3);
			sendSucceeds = false;
			await service.sweep(new Date('2026-11-01T06:00:00Z'));
			// As if the process had stopped after saving the invoice, before its email went
			await dataSource
				.getRepository(InvoiceScheduleRun)
				.update(
					{ invoiceScheduleId: SCHEDULE },
					{ status: InvoiceScheduleRunStatusEnum.CLAIMED, invoiceId: null }
				);
			sentEmails = [];
			sendSucceeds = true;

			await service.sweep(new Date('2026-11-01T07:30:00Z'));

			const [invoice] = await madeInvoices();
			expect(sentEmails).toEqual([{ email: 'billing@acme.test', invoiceId: invoice.id }]);
			expect(invoice.status).toBe('SENT');
			expect(await runs()).toMatchObject([{ status: InvoiceScheduleRunStatusEnum.SENT, invoiceId: invoice.id }]);
		},
		TIMEOUT
	);

	it(
		'only marks Sent a draft whose email went before the process stopped: the client gets no second email',
		async () => {
			await schedule({ sendInvoice: true });
			await track(MARIE, '2026-10-05', '09:00', 3);
			sendSucceeds = false;
			await service.sweep(new Date('2026-11-01T06:00:00Z'));
			const [draft] = await madeInvoices();
			// The email went and its delivery was recorded; the process stopped before marking the invoice Sent
			await insertRow(EstimateEmail, {
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				invoiceId: draft.id,
				email: 'billing@acme.test',
				token: 'token',
				expireDate: new Date('2026-11-08T00:00:00Z')
			});
			await dataSource
				.getRepository(InvoiceScheduleRun)
				.update(
					{ invoiceScheduleId: SCHEDULE },
					{ status: InvoiceScheduleRunStatusEnum.CLAIMED, invoiceId: null }
				);
			sentEmails = [];

			await service.sweep(new Date('2026-11-01T07:30:00Z'));

			expect(sentEmails).toEqual([]);
			expect((await madeInvoices())[0].status).toBe('SENT');
			expect(await runs()).toMatchObject([{ status: InvoiceScheduleRunStatusEnum.SENT, invoiceId: draft.id }]);
		},
		TIMEOUT
	);

	it(
		'keeps on its run the draft a stopped process saved, when its author may no longer send it',
		async () => {
			await schedule({ sendInvoice: true });
			await track(MARIE, '2026-10-05', '09:00', 3);
			sendSucceeds = false;
			await service.sweep(new Date('2026-11-01T06:00:00Z'));
			const [draft] = await madeInvoices();
			// As if the process had stopped after saving the invoice, before its email went
			await dataSource
				.getRepository(InvoiceScheduleRun)
				.update(
					{ invoiceScheduleId: SCHEDULE },
					{ status: InvoiceScheduleRunStatusEnum.CLAIMED, invoiceId: null }
				);
			sentEmails = [];
			sendSucceeds = true;
			authorPermissions = [PermissionsEnum.INVOICES_VIEW, PermissionsEnum.ALL_ORG_VIEW];

			const report = await service.sweep(new Date('2026-11-01T07:30:00Z'));

			expect(sentEmails).toEqual([]);
			expect((await madeInvoices())[0].status).toBe('DRAFT');
			expect(report).toMatchObject({ invoiced: 1, sent: 0, failed: 1 });
			// The period is billed, by the draft: the run keeps it, and says why it was not sent
			expect(await runs()).toMatchObject([
				{
					status: InvoiceScheduleRunStatusEnum.NOT_SENT,
					reason: InvoiceScheduleRunReasonEnum.AUTHOR_CANNOT_INVOICE,
					invoiceId: draft.id
				}
			]);
		},
		TIMEOUT
	);

	it(
		'records nothing over a run another process took again meanwhile, which then records the invoice made',
		async () => {
			await schedule();
			await track(MARIE, '2026-10-05', '09:00', 3);
			// While this process reads the time, another one takes the run again, as after an hour without news of it
			duringTimeRead = async () => {
				duringTimeRead = null;
				await dataSource
					.getRepository(InvoiceScheduleRun)
					.update({ invoiceScheduleId: SCHEDULE }, { claimedAt: new Date('2026-11-01T07:00:00Z') });
			};

			await service.sweep(new Date('2026-11-01T06:00:00Z'));

			const [invoice] = await madeInvoices();
			expect(await runs()).toMatchObject([
				{ status: InvoiceScheduleRunStatusEnum.CLAIMED, invoiceId: null, finishedAt: null }
			]);

			// That claim gets old in turn: the run is taken again, and records the invoice saved for its period
			await service.sweep(new Date('2026-11-01T08:00:00Z'));

			expect(await madeInvoices()).toHaveLength(1);
			expect(await runs()).toMatchObject([
				{ status: InvoiceScheduleRunStatusEnum.DRAFTED, invoiceId: invoice.id }
			]);
		},
		TIMEOUT
	);

	it(
		'takes again a failed run of an earlier timeline that started on the same day, for the period billed now',
		async () => {
			await schedule();
			await track(MARIE, '2026-10-05', '09:00', 3);
			// The week from 1 October failed while the schedule was weekly; it is monthly from that day now
			await dataSource.getRepository(InvoiceScheduleRun).insert({
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				invoiceScheduleId: SCHEDULE,
				periodStart: '2026-10-01',
				periodEnd: '2026-10-07',
				status: InvoiceScheduleRunStatusEnum.FAILED,
				reason: InvoiceScheduleRunReasonEnum.AUTHOR_CANNOT_INVOICE,
				claimedAt: new Date('2026-10-08T06:00:00Z'),
				finishedAt: new Date('2026-10-08T06:00:00Z')
			} as never);

			await service.sweep(new Date('2026-11-01T06:00:00Z'));

			const [invoice] = await madeInvoices();
			expect(await runs()).toMatchObject([
				{
					periodStart: '2026-10-01',
					periodEnd: '2026-10-31',
					status: InvoiceScheduleRunStatusEnum.DRAFTED,
					invoiceId: invoice.id
				}
			]);
		},
		TIMEOUT
	);
});
