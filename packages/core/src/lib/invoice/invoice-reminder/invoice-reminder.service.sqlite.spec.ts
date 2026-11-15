/**
 * This import must stay FIRST, before any import that pulls a core service (see the ORM parity suite).
 */
import '../../core/entities/internal';

import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InvoiceStatusTypesEnum, LanguagesEnum } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { coreEntities } from '../../core/entities';
import { CreateInvoiceReminderTable1791000011920 } from '../../database/migrations/1791000011920-CreateInvoiceReminderTable';
import { INVOICE_REMINDER_SWEEP_PAGE_SIZE } from './invoice-reminder.constants';
import { InvoiceReminder } from './invoice-reminder.entity';
import { latestRemindedDueDate } from './invoice-reminder.rules';
import { InvoiceReminderService } from './invoice-reminder.service';

/**
 * The payment reminder sweep against a real SQLite database: the organizations, invoices, clients and invoice emails
 * as the platform stores them, and the `invoice_reminder` table its migration creates, whose unique key is what sends
 * each reminder once. The mail and the PDF are doubled: what is under test is which reminders the sweep sends, to
 * whom, saying what, and how many times.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-12-01T10:00:00.000Z');
/** A time as TypeORM writes it on SQLite: UTC, without its zone. */
const stored = (date: Date) => date.toISOString().replace('T', ' ').replace('Z', '');
const fromNow = (ms: number) => new Date(NOW.getTime() + ms);

const TENANT = randomUUID();
const OTHER_TENANT = randomUUID();

interface IInvoiceFixture {
	organizationId?: string;
	tenantId?: string;
	/** The due date, from NOW. */
	dueIn: number;
	status?: string;
	isEstimate?: boolean | null;
	paid?: boolean | null;
	isArchived?: boolean;
	deleted?: boolean;
	totalValue?: number | null;
	alreadyPaid?: number | null;
	token?: string | null;
	contactName?: string | null;
	/** When the invoice was created, from NOW; a month before it by default. */
	createdIn?: number;
	/** When the invoice was emailed, from NOW; null: never emailed from the platform. */
	emailedIn?: number | null;
	email?: string;
	languageCode?: string | null;
}

describe('InvoiceReminderService on SQLite', () => {
	let dataSource: DataSource;
	let emails: { sendInvoiceReminder: jest.Mock };
	let invoices: { generateTenantInvoicePdf: jest.Mock };
	let service: InvoiceReminderService;
	let organization: string;
	let invoiceNumber: number;

	beforeEach(async () => {
		invoiceNumber = 0;
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
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
		// The columns the sweep reads, as the platform's own tables have them; the reminders' table from its migration.
		await dataSource.query(`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL)`);
		await dataSource.query(`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL)`);
		await dataSource.query(
			`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "name" varchar, "timeZone" varchar, "dateFormat" varchar, "invoiceRemindersEnabled" boolean NOT NULL DEFAULT (0), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "organization_contact" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "name" varchar, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "invoice" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "invoiceNumber" numeric, "dueDate" datetime, "totalValue" numeric, "alreadyPaid" numeric, "currency" varchar, "token" varchar, "toContactId" varchar, "status" varchar, "isEstimate" boolean, "paid" boolean, "isArchived" boolean DEFAULT (0), "createdAt" datetime NOT NULL, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "estimate_email" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, "email" varchar, "invoiceId" varchar, "languageCode" varchar, "createdAt" datetime NOT NULL, "deletedAt" datetime)`
		);
		await dataSource.query(
			`CREATE TABLE "email_template" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar, "languageCode" varchar, "organizationId" varchar, "tenantId" varchar, "deletedAt" datetime)`
		);
		const runner = dataSource.createQueryRunner();
		await new CreateInvoiceReminderTable1791000011920().up(runner);
		await runner.release();
		for (const id of [TENANT, OTHER_TENANT]) await dataSource.query(`INSERT INTO "tenant" ("id") VALUES (?)`, [id]);
		await seedTemplate();
		organization = await anOrganization({ name: 'Ever Org', dateFormat: 'DD/MM/YYYY', timeZone: 'Europe/Paris' });

		emails = { sendInvoiceReminder: jest.fn(async () => true) };
		invoices = { generateTenantInvoicePdf: jest.fn(async () => Buffer.from('%PDF')) };
		service = new InvoiceReminderService(dataSource, emails as never, invoices as never);
	});

	afterEach(async () => {
		await dataSource.destroy();
		jest.restoreAllMocks();
	});

	async function seedTemplate(): Promise<void> {
		await dataSource.query(
			`INSERT INTO "email_template" ("id", "name", "languageCode", "organizationId", "tenantId") VALUES (?, 'invoice-reminder/html', 'en', NULL, NULL)`,
			[randomUUID()]
		);
	}

	async function anOrganization(
		options: {
			name?: string;
			tenantId?: string;
			enabled?: boolean;
			isActive?: boolean;
			dateFormat?: string;
			timeZone?: string;
		} = {}
	): Promise<string> {
		const id = randomUUID();
		await dataSource.query(
			`INSERT INTO "organization" ("id", "tenantId", "name", "timeZone", "dateFormat", "invoiceRemindersEnabled", "isActive") VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				options.tenantId ?? TENANT,
				options.name ?? 'Other Org',
				options.timeZone ?? 'UTC',
				options.dateFormat ?? 'YYYY-MM-DD',
				options.enabled === false ? 0 : 1,
				options.isActive === false ? 0 : 1
			]
		);
		return id;
	}

	/** An invoice, and the email that sent it to the client unless `emailedIn` is null. */
	async function anInvoice(options: IInvoiceFixture): Promise<string> {
		const id = randomUUID();
		const tenantId = options.tenantId ?? TENANT;
		const organizationId = options.organizationId ?? organization;
		let contactId: string | null = null;
		if (options.contactName !== null) {
			contactId = randomUUID();
			await dataSource.query(`INSERT INTO "organization_contact" ("id", "tenantId", "name") VALUES (?, ?, ?)`, [
				contactId,
				tenantId,
				options.contactName ?? 'Acme Corp'
			]);
		}
		invoiceNumber += 1;
		await dataSource.query(
			`INSERT INTO "invoice" ("id", "tenantId", "organizationId", "invoiceNumber", "dueDate", "totalValue", "alreadyPaid", "currency", "token", "toContactId", "status", "isEstimate", "paid", "isArchived", "createdAt", "deletedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				tenantId,
				organizationId,
				invoiceNumber,
				stored(fromNow(options.dueIn)),
				options.totalValue === undefined ? 1250 : options.totalValue,
				options.alreadyPaid === undefined ? 250 : options.alreadyPaid,
				'USD',
				options.token === undefined ? 'share-token' : options.token,
				contactId,
				options.status ?? InvoiceStatusTypesEnum.SENT,
				options.isEstimate === undefined ? 0 : options.isEstimate === null ? null : Number(options.isEstimate),
				options.paid === undefined ? 0 : options.paid === null ? null : Number(options.paid),
				options.isArchived ? 1 : 0,
				stored(fromNow(options.createdIn ?? -30 * DAY)),
				options.deleted ? stored(fromNow(-HOUR)) : null
			]
		);
		if (options.emailedIn !== null) {
			await emailed(id, {
				at: fromNow(options.emailedIn ?? -20 * DAY),
				email: options.email ?? 'billing@acme.test',
				languageCode: options.languageCode === undefined ? LanguagesEnum.ENGLISH : options.languageCode,
				tenantId
			});
		}
		return id;
	}

	/** The row an invoice's email leaves once it went. */
	async function emailed(
		invoiceId: string,
		options: { at: Date; email: string; languageCode: string | null; tenantId?: string }
	): Promise<void> {
		await dataSource.query(
			`INSERT INTO "estimate_email" ("id", "tenantId", "organizationId", "email", "invoiceId", "languageCode", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				randomUUID(),
				options.tenantId ?? TENANT,
				organization,
				options.email,
				invoiceId,
				options.languageCode,
				stored(options.at)
			]
		);
	}

	const claims = () => dataSource.getRepository(InvoiceReminder).find({ order: { step: 'ASC', claimedAt: 'ASC' } });
	const sent = () => emails.sendInvoiceReminder.mock.calls.map(([input]) => input);

	it('emails the client the day after the due date, once, to the address and in the language the invoice went in', async () => {
		const invoice = await anInvoice({ dueIn: -DAY - HOUR, languageCode: LanguagesEnum.BULGARIAN });

		const report = await service.sweep(NOW);

		expect(report).toEqual({ checked: 1, reminded: 1, blocked: 0, failed: 0 });
		expect(sent()).toEqual([
			{
				languageCode: LanguagesEnum.BULGARIAN,
				email: 'billing@acme.test',
				organization: expect.objectContaining({ id: organization, tenantId: TENANT, name: 'Ever Org' }),
				invoiceId: invoice,
				invoiceNumber: 1,
				isOverdue: true,
				// 30 November 09:00 UTC, as the organization writes a day in its own zone
				dueDate: '30/11/2026',
				// What is left to pay, as Bulgarian writes an amount
				amountDue: new Intl.NumberFormat('bg', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
					1000
				),
				currency: 'USD',
				contactName: 'Acme Corp',
				publicToken: 'share-token',
				pdf: Buffer.from('%PDF').toString('base64')
			}
		]);
		expect(invoices.generateTenantInvoicePdf).toHaveBeenCalledWith(invoice, TENANT, LanguagesEnum.BULGARIAN);
		expect(await claims()).toEqual([
			expect.objectContaining({ invoiceId: invoice, step: 2, email: 'billing@acme.test', sentAt: NOW })
		]);

		// The next sweeps send nothing more for that step
		await service.sweep(fromNow(HOUR));
		await service.sweep(fromNow(DAY));
		expect(emails.sendInvoiceReminder).toHaveBeenCalledTimes(1);
	});

	it('reads a due date saved as the forms save it, the end of the picked day, in the organization zone', async () => {
		// 30 November picked in Paris: saved as 30 November 23:59:59.999 there, 22:59:59.999 UTC
		await anInvoice({ dueIn: -11 * HOUR - 1 });

		// 30 November, 23:30 in Paris: the client still has the day to pay
		await service.sweep(fromNow(-11 * HOUR - 30 * 60 * 1000));
		expect(emails.sendInvoiceReminder).not.toHaveBeenCalled();

		// 1 December, 00:30 in Paris: the day after the due date
		await service.sweep(fromNow(-11 * HOUR + 30 * 60 * 1000));
		expect(sent()).toEqual([expect.objectContaining({ isOverdue: true, dueDate: '30/11/2026' })]);
		expect(await claims()).toEqual([expect.objectContaining({ step: 2 })]);
	});

	it('emails the reminder before the due date as not overdue', async () => {
		await anInvoice({ dueIn: 3 * DAY - HOUR });

		await service.sweep(NOW);

		expect(sent()).toEqual([expect.objectContaining({ isOverdue: false })]);
		expect(await claims()).toEqual([expect.objectContaining({ step: 1 })]);
	});

	it('goes through the steps, one reminder each, until the last', async () => {
		await anInvoice({ dueIn: 4 * DAY });

		for (let day = 0; day <= 30; day++) {
			await service.sweep(fromNow(day * DAY));
		}

		expect((await claims()).map((claim) => claim.step)).toEqual([1, 2, 3, 4]);
		expect(sent().map((input) => input.isOverdue)).toEqual([false, true, true, true]);
	});

	it.each([
		['the organization did not turn the reminders on', { organizationOff: true }],
		['it is an estimate', { isEstimate: true }],
		['it is a draft', { status: InvoiceStatusTypesEnum.DRAFT }],
		['it is paid in full', { status: InvoiceStatusTypesEnum.FULLY_PAID }],
		['it is void', { status: InvoiceStatusTypesEnum.VOID }],
		['it is marked paid', { paid: true }],
		['nothing is left to pay', { alreadyPaid: 1250 }],
		['it has no total', { totalValue: null }],
		['it is archived', { isArchived: true }],
		['it is deleted', { deleted: true }],
		['it was never emailed from the platform', { emailedIn: null }],
		['it was emailed less than a day before the reminder', { emailedIn: -DAY }]
	])('sends nothing when %s', async (_, options: Partial<IInvoiceFixture> & { organizationOff?: boolean }) => {
		const organizationId = options.organizationOff ? await anOrganization({ enabled: false }) : undefined;
		await anInvoice({ dueIn: -DAY - HOUR, ...options, organizationId });

		const report = await service.sweep(NOW);

		expect(report.reminded).toBe(0);
		expect(emails.sendInvoiceReminder).not.toHaveBeenCalled();
		expect(await claims()).toEqual([]);
	});

	it('reminds a partly paid or never-flagged invoice of what is left', async () => {
		await anInvoice({ dueIn: -DAY - HOUR, status: InvoiceStatusTypesEnum.PARTIALLY_PAID, alreadyPaid: 1000 });
		await anInvoice({ dueIn: -DAY - HOUR, paid: null, isEstimate: null, alreadyPaid: null });

		await service.sweep(NOW);

		expect(
			sent()
				.map((input) => input.amountDue)
				.sort()
		).toEqual(['1,250.00', '250.00']);
	});

	it('sends nothing for an organization that is inactive', async () => {
		await anInvoice({ dueIn: -DAY - HOUR, organizationId: await anOrganization({ isActive: false }) });

		await service.sweep(NOW);

		expect(emails.sendInvoiceReminder).not.toHaveBeenCalled();
	});

	it('writes to where the invoice was emailed last, in that language, and English when none was recorded', async () => {
		const invoice = await anInvoice({ dueIn: -DAY - HOUR, email: 'first@acme.test' });
		await emailed(invoice, { at: fromNow(-10 * DAY), email: 'accounts@acme.test', languageCode: null });

		await service.sweep(NOW);

		expect(sent()).toEqual([
			expect.objectContaining({ email: 'accounts@acme.test', languageCode: LanguagesEnum.ENGLISH })
		]);
	});

	it('never reads an email row of another tenant as where the invoice went', async () => {
		const invoice = await anInvoice({ dueIn: -DAY - HOUR, emailedIn: null });
		await emailed(invoice, {
			at: fromNow(-10 * DAY),
			email: 'stranger@other.test',
			languageCode: 'en',
			tenantId: OTHER_TENANT
		});

		await service.sweep(NOW);

		expect(emails.sendInvoiceReminder).not.toHaveBeenCalled();
	});

	it('sends only the latest step when the reminders were turned on late, and nothing long after the last', async () => {
		await anInvoice({ dueIn: -8 * DAY });
		await anInvoice({ dueIn: -40 * DAY });

		const report = await service.sweep(NOW);

		expect(report).toEqual(expect.objectContaining({ checked: 1, reminded: 1 }));
		expect((await claims()).map((claim) => claim.step)).toEqual([3]);
	});

	it('sends each reminder once when two sweeps run at the same moment', async () => {
		await anInvoice({ dueIn: -DAY - HOUR });
		const other = new InvoiceReminderService(dataSource, emails as never, invoices as never);

		const reports = await Promise.all([service.sweep(NOW), other.sweep(NOW)]);

		expect(emails.sendInvoiceReminder).toHaveBeenCalledTimes(1);
		expect(reports.map((report) => report.reminded).sort()).toEqual([0, 1]);
		expect(await claims()).toHaveLength(1);
	});

	it('gives a failed send back, and the next sweep sends it while it is due', async () => {
		await anInvoice({ dueIn: -DAY - HOUR });
		emails.sendInvoiceReminder.mockRejectedValueOnce(new Error('SMTP down'));

		expect(await service.sweep(NOW)).toEqual(expect.objectContaining({ reminded: 0, failed: 1 }));
		expect(await claims()).toEqual([]);

		expect(await service.sweep(fromNow(HOUR))).toEqual(expect.objectContaining({ reminded: 1, failed: 0 }));
		expect(await claims()).toEqual([expect.objectContaining({ step: 2, sentAt: fromNow(HOUR) })]);
	});

	it('keeps the claim of a reminder to a blocked domain unsent, and does not try it again', async () => {
		await anInvoice({ dueIn: -DAY - HOUR });
		emails.sendInvoiceReminder.mockResolvedValueOnce(false);

		expect(await service.sweep(NOW)).toEqual(expect.objectContaining({ reminded: 0, blocked: 1 }));
		await service.sweep(fromNow(HOUR));

		expect(emails.sendInvoiceReminder).toHaveBeenCalledTimes(1);
		expect(await claims()).toEqual([expect.objectContaining({ step: 2, sentAt: null })]);
	});

	it('sends the reminder without the PDF when it cannot be rendered', async () => {
		await anInvoice({ dueIn: -DAY - HOUR });
		invoices.generateTenantInvoicePdf.mockRejectedValueOnce(new Error('no fonts'));

		await service.sweep(NOW);

		expect(sent()).toEqual([expect.objectContaining({ pdf: null })]);
	});

	it('sends no link and names no client when the invoice has neither', async () => {
		await anInvoice({ dueIn: -DAY - HOUR, token: null, contactName: null });

		await service.sweep(NOW);

		expect(sent()).toEqual([expect.objectContaining({ publicToken: null, contactName: null })]);
	});

	it('starts the steps again when the due date moves', async () => {
		const invoice = await anInvoice({ dueIn: -DAY - HOUR });
		await service.sweep(NOW);
		// The client was given a week more
		await dataSource.query(`UPDATE "invoice" SET "dueDate" = ? WHERE "id" = ?`, [
			stored(fromNow(6 * DAY - HOUR)),
			invoice
		]);

		await service.sweep(fromNow(3 * DAY));
		await service.sweep(fromNow(7 * DAY));

		expect((await claims()).map((claim) => claim.step)).toEqual([1, 2, 2]);
		expect(emails.sendInvoiceReminder).toHaveBeenCalledTimes(3);
	});

	describe('an invoice that changes while the sweep emails the ones before it', () => {
		/** Two invoices due the same reminder; the sweep emails the first, then the second. */
		async function twoDue(): Promise<{ first: string; second: string }> {
			const first = await anInvoice({ dueIn: -DAY - 2 * HOUR });
			const second = await anInvoice({ dueIn: -DAY - HOUR });
			return { first, second };
		}

		/** Runs `change` while the first invoice's reminder is being sent. */
		function whileTheFirstIsSent(change: () => Promise<unknown>): void {
			emails.sendInvoiceReminder.mockImplementationOnce(async () => {
				await change();
				return true;
			});
		}

		it.each([
			['paid in full', (id: string) => [`UPDATE "invoice" SET "status" = 'FULLY_PAID' WHERE "id" = ?`, [id]]],
			['marked paid', (id: string) => [`UPDATE "invoice" SET "paid" = 1 WHERE "id" = ?`, [id]]],
			['voided', (id: string) => [`UPDATE "invoice" SET "status" = 'VOID' WHERE "id" = ?`, [id]]],
			['deleted', (id: string) => [`UPDATE "invoice" SET "deletedAt" = ? WHERE "id" = ?`, [stored(NOW), id]]],
			[
				'given another due date',
				(id: string) => [`UPDATE "invoice" SET "dueDate" = ? WHERE "id" = ?`, [stored(fromNow(10 * DAY)), id]]
			]
		])('sends nothing for one %s meanwhile, and gives its claim back', async (_, update) => {
			const { first, second } = await twoDue();
			whileTheFirstIsSent(() => dataSource.query(...(update(second) as [string, unknown[]])));

			const report = await service.sweep(NOW);

			expect(sent().map((input) => input.invoiceId)).toEqual([first]);
			expect(report).toEqual(expect.objectContaining({ reminded: 1, failed: 0 }));
			expect((await claims()).map((claim) => claim.invoiceId)).toEqual([first]);
		});

		it('sends nothing once the organization turned the reminders off meanwhile', async () => {
			const { first } = await twoDue();
			whileTheFirstIsSent(() =>
				dataSource.query(`UPDATE "organization" SET "invoiceRemindersEnabled" = 0 WHERE "id" = ?`, [
					organization
				])
			);

			await service.sweep(NOW);

			expect(sent().map((input) => input.invoiceId)).toEqual([first]);
			expect((await claims()).map((claim) => claim.invoiceId)).toEqual([first]);
		});

		it('sends nothing on the heels of the invoice emailed again meanwhile', async () => {
			const { first, second } = await twoDue();
			whileTheFirstIsSent(() =>
				emailed(second, { at: NOW, email: 'billing@acme.test', languageCode: LanguagesEnum.ENGLISH })
			);

			await service.sweep(NOW);

			expect(sent().map((input) => input.invoiceId)).toEqual([first]);
		});

		it('sends what is left to pay after a payment made meanwhile', async () => {
			const { second } = await twoDue();
			whileTheFirstIsSent(() =>
				dataSource.query(`UPDATE "invoice" SET "alreadyPaid" = 1100 WHERE "id" = ?`, [second])
			);

			await service.sweep(NOW);

			expect(sent().map((input) => input.amountDue)).toEqual(['1,000.00', '150.00']);
		});

		it('sends nothing for one paid while its own PDF was rendered', async () => {
			const invoice = await anInvoice({ dueIn: -DAY - HOUR });
			invoices.generateTenantInvoicePdf.mockImplementationOnce(async () => {
				await dataSource.query(`UPDATE "invoice" SET "status" = 'FULLY_PAID' WHERE "id" = ?`, [invoice]);
				return Buffer.from('%PDF');
			});

			const report = await service.sweep(NOW);

			expect(emails.sendInvoiceReminder).not.toHaveBeenCalled();
			expect(report).toEqual(expect.objectContaining({ reminded: 0, failed: 0 }));
			expect(await claims()).toEqual([]);
		});
	});

	it('reads every page of invoices', async () => {
		for (let i = 0; i <= INVOICE_REMINDER_SWEEP_PAGE_SIZE; i++) {
			await anInvoice({ dueIn: -DAY - HOUR - i * 60 * 1000 });
		}

		const report = await service.sweep(NOW);

		expect(report).toEqual(
			expect.objectContaining({
				checked: INVOICE_REMINDER_SWEEP_PAGE_SIZE + 1,
				reminded: INVOICE_REMINDER_SWEEP_PAGE_SIZE + 1
			})
		);
	});

	it('starts the next pass where one out of time stopped, so a page slow to send does not hold back the rest', async () => {
		for (let i = 0; i <= INVOICE_REMINDER_SWEEP_PAGE_SIZE; i++) {
			await anInvoice({ dueIn: -DAY - HOUR - i * 60 * 1000 });
		}
		// The mail server times out on every send of the first page, which takes the whole pass
		emails.sendInvoiceReminder.mockRejectedValue(new Error('SMTP timeout'));
		expect(await service.sweep(NOW, 0)).toEqual(
			expect.objectContaining({
				checked: INVOICE_REMINDER_SWEEP_PAGE_SIZE,
				failed: INVOICE_REMINDER_SWEEP_PAGE_SIZE
			})
		);
		emails.sendInvoiceReminder.mockResolvedValue(true);

		// The next pass goes on after that page, to the invoice the first one never reached
		expect(await service.sweep(fromNow(HOUR), 0)).toEqual(expect.objectContaining({ checked: 1, reminded: 1 }));
		// Having read to the end, the one after starts from the top again, and sends what failed
		expect(await service.sweep(fromNow(2 * HOUR), 0)).toEqual(
			expect.objectContaining({
				checked: INVOICE_REMINDER_SWEEP_PAGE_SIZE,
				reminded: INVOICE_REMINDER_SWEEP_PAGE_SIZE
			})
		);
		expect(await claims()).toHaveLength(INVOICE_REMINDER_SWEEP_PAGE_SIZE + 1);
	});

	it('ends each read of the list at the due date it started with, so invoices coming in after the cursor do not hold back the ones before it', async () => {
		for (let i = 0; i <= INVOICE_REMINDER_SWEEP_PAGE_SIZE; i++) {
			await anInvoice({ dueIn: -DAY - HOUR - i * 60 * 1000 });
		}
		/** A page of invoices that come into the window by `at`, after every invoice there before. */
		const comingIn = async (at: Date) => {
			for (let i = 0; i < INVOICE_REMINDER_SWEEP_PAGE_SIZE; i++) {
				await anInvoice({ dueIn: latestRemindedDueDate(at).getTime() - NOW.getTime() - i * 1000 });
			}
		};
		// The mail server times out on every send of the first page, which takes the whole pass
		emails.sendInvoiceReminder.mockRejectedValue(new Error('SMTP timeout'));
		await service.sweep(NOW, 0);
		emails.sendInvoiceReminder.mockResolvedValue(true);

		// A full page comes into the window before each pass: the read still ends with the invoice it never reached
		await comingIn(fromNow(HOUR));
		expect(await service.sweep(fromNow(HOUR), 0)).toEqual(expect.objectContaining({ checked: 1, reminded: 1 }));
		// So the next pass starts from the top again, and sends what failed
		await comingIn(fromNow(2 * HOUR));
		expect(await service.sweep(fromNow(2 * HOUR), 0)).toEqual(
			expect.objectContaining({
				checked: INVOICE_REMINDER_SWEEP_PAGE_SIZE,
				reminded: INVOICE_REMINDER_SWEEP_PAGE_SIZE
			})
		);
	});

	it('ends each read of the list with the invoices there when it started, so invoices created after it do not hold back the ones before the cursor', async () => {
		for (let i = 0; i <= INVOICE_REMINDER_SWEEP_PAGE_SIZE; i++) {
			await anInvoice({ dueIn: -DAY - HOUR - i * 60 * 1000 });
		}
		let created = 0;
		/** A page of invoices created at `at`, due right after every invoice there before, within the read's window. */
		const createdAt = async (at: Date) => {
			for (let i = 0; i < INVOICE_REMINDER_SWEEP_PAGE_SIZE; i++) {
				created += 1;
				await anInvoice({ dueIn: -DAY - HOUR + created * 1000, createdIn: at.getTime() - NOW.getTime() });
			}
		};
		// The mail server times out on every send of the first page, which takes the whole pass
		emails.sendInvoiceReminder.mockRejectedValue(new Error('SMTP timeout'));
		await service.sweep(NOW, 0);
		emails.sendInvoiceReminder.mockResolvedValue(true);

		// A full page is created before each pass: the read still ends with the invoice it never reached
		await createdAt(fromNow(HOUR - 60 * 1000));
		expect(await service.sweep(fromNow(HOUR), 0)).toEqual(expect.objectContaining({ checked: 1, reminded: 1 }));
		// So the next pass starts from the top again, and sends what failed
		await createdAt(fromNow(2 * HOUR - 60 * 1000));
		expect(await service.sweep(fromNow(2 * HOUR), 0)).toEqual(
			expect.objectContaining({
				checked: INVOICE_REMINDER_SWEEP_PAGE_SIZE,
				reminded: INVOICE_REMINDER_SWEEP_PAGE_SIZE
			})
		);
	});

	it('sends nothing, and says so, while the template is not seeded: the renderer would send an empty email', async () => {
		await dataSource.query(`DELETE FROM "email_template"`);
		await anInvoice({ dueIn: -DAY - HOUR });

		const report = await service.sweep(NOW);

		expect(report).toEqual({ checked: 0, reminded: 0, blocked: 0, failed: 0 });
		expect(emails.sendInvoiceReminder).not.toHaveBeenCalled();
		expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('is not seeded'));
	});
});
