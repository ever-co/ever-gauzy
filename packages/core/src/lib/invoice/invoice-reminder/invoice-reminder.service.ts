import { randomUUID } from 'node:crypto';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/core';
import { Brackets, DataSource, In, IsNull, SelectQueryBuilder } from 'typeorm';
import { EmailTemplateEnum, ID, IOrganization, LanguagesEnum } from '@gauzy/contracts';
import { runInMikroOrmContext } from '../../core/context/mikro-orm-context';
import { EmailTemplate, EstimateEmail, Invoice, Organization, OrganizationContact } from '../../core/entities/internal';
import { isUniqueViolation } from '../../core/errors/unique-violation';
import { EmailService } from '../../email-send/email.service';
import { formattedAmountOf } from '../estimate-answer/estimate-answer.notice';
import { instantOf } from '../../time-tracking/timer-reminder/timer-reminder.rules';
import { formatInvoiceDay, invoiceTimeZoneOf } from '../invoice-date.util';
import { InvoiceService } from '../invoice.service';
import { InvoiceReminder } from './invoice-reminder.entity';
import { INVOICE_REMINDER_SWEEP_PAGE_SIZE, INVOICE_REMINDER_SWEEP_TIME_BUDGET_MS } from './invoice-reminder.constants';
import {
	amountLeftToPay,
	earliestRemindedDueDate,
	IDueInvoiceReminder,
	INVOICE_REMINDER_STATUSES,
	invoiceReminderDueAt,
	latestRemindedDueDate
} from './invoice-reminder.rules';

/** What one sweep did. */
export interface IInvoiceReminderSweepReport {
	/** The invoices read: sent, unpaid, of an organization that turned the reminders on, due within the steps. */
	checked: number;
	/** The reminders sent. */
	reminded: number;
	/** The reminders to an address of a domain the platform never emails: claimed, and never sent. */
	blocked: number;
	/** The reminders that could not be sent; the next sweep tries them again while they are due. */
	failed: number;
}

/** An invoice, as the sweep reads it. */
export interface IInvoiceReminderInvoiceRow {
	id: ID;
	tenantId: ID;
	organizationId: ID;
	invoiceNumber: number | string;
	dueDate: Date | string;
	totalValue: number | string | null;
	alreadyPaid: number | string | null;
	currency: string | null;
	token: string | null;
	toContactId: ID | null;
	/** Its organization's time zone, which its due day is read in. */
	timeZone: string | null;
}

/** The last email of an invoice: where, when and in which language it went. */
interface IInvoiceDelivery {
	email: string;
	languageCode: string | null;
	emailedAt: Date | string;
}

/** A claimed reminder, as the sweep reads it. */
interface IInvoiceReminderClaim {
	id: ID;
	step: number;
	dueDate: Date | string;
}

/** A claim's time, to the second: MySQL keeps no fraction of a second. */
function claimTimeOf(now: Date): Date {
	return new Date(Math.floor(now.getTime() / 1000) * 1000);
}

/**
 * Emails the client of an unpaid invoice a payment reminder, when its organization turned them on
 * (`organization.invoiceRemindersEnabled`): three days before the due date, then one, seven and fourteen days after
 * it (see `invoice-reminder.rules.ts`), until the invoice is paid in full.
 *
 * - **Which invoices.** Sent and not paid in full (status SENT, VIEWED or PARTIALLY_PAID, not marked paid, something
 *   left to pay), not an estimate, not archived, of an active organization that turned the reminders on, and emailed to
 *   the client from the platform since invoices record where they went (`estimate_email.invoiceId`). An invoice sent in
 *   another way (marked sent, sent to a connected organization) has no address to remind, and gets nothing.
 * - **To whom, in what.** The address the invoice was last emailed to, in the language it was emailed in, with the
 *   invoice attached again as a PDF (sent without it when the PDF cannot be rendered), the amount left to pay, the due
 *   date as the organization writes a day, and the link to its public page when the organization generated one.
 * - **Never a burst.** Only the latest step whose moment has come is due, and only for two days: turning the reminders
 *   on, or a sweep that did not run for a while, never sends a client the reminders of the past at once. None goes
 *   within a day of the invoice's own email.
 * - **Once, whatever the processes.** The sweep inserts an `invoice_reminder` row for the invoice, the step and the due
 *   date before it sends, and the row is unique on the three: when several processes sweep at once, one insert goes
 *   through and the others send nothing. A send that fails gives the row back, so the next sweep tries again while the
 *   reminder is due. A process that stops between its claim and its send leaves the claim unsent: that reminder is lost
 *   rather than risked twice, since an email, unlike a notification, cannot be looked up once sent.
 * - **Still due when it goes.** The invoice is read again right before its email goes: one paid, voided, given another
 *   due date or emailed again while the sweep sent the ones before it, or whose organization turned the reminders off
 *   meanwhile, gets nothing, and a payment made meanwhile shows in the amount.
 * - **Tenant by tenant.** Every read names the invoice's tenant, and each email goes through its organization's mail
 *   settings and is filed in its email history, which is where the organization sees the reminders it sent. Under
 *   DB_ORM=mikro-orm the mail settings are read through MikroORM, which refuses its global EntityManager outside a
 *   request: each reminder is then sent in a MikroORM request context of its own, since no request opened one.
 * - **Never an empty email.** The renderer answers an empty email for a template it cannot find, so while the
 *   `invoice-reminder` template is not seeded (its migration failed), the sweep sends nothing and says so.
 */
@Injectable()
export class InvoiceReminderService {
	private readonly logger = new Logger(InvoiceReminderService.name);
	/**
	 * The read of the list that the last pass of this process left unfinished when its time ran out: where it stopped,
	 * and when it started. A read covers the invoices created by then, due no later than the window's latest due date
	 * then (see `invoicesThatMayBeDue`); the next pass goes on after where it stopped, and only a pass that reads to its
	 * end starts the next read from the top again. Without the cursor, a page slow to send (a mail server timing out)
	 * would take every pass's time, pass after pass, and the invoices after it would miss their reminders; without the
	 * bounds, invoices created or coming into the window after the cursor could keep a read from ever ending, and the
	 * ones before it would wait.
	 */
	private unfinished: { after: IInvoiceReminderInvoiceRow | null; startedAt: Date } | null = null;

	constructor(
		private readonly dataSource: DataSource,
		private readonly emails: EmailService,
		private readonly invoices: InvoiceService,
		/** Opens the MikroORM request context a reminder is sent in under DB_ORM=mikro-orm. */
		@Optional() private readonly orm?: MikroORM
	) {}

	/**
	 * Sends the reminders that are due: reads the invoices that may be due one a page at a time, in the order they are
	 * due, until the list is read or the time budget of the pass is spent; a pass out of time leaves the rest to the
	 * next one (see `unfinished`).
	 *
	 * @param now The moment the reminders are due at.
	 * @param budgetMs How long the pass may keep reading pages.
	 */
	async sweep(
		now: Date = new Date(),
		budgetMs: number = INVOICE_REMINDER_SWEEP_TIME_BUDGET_MS
	): Promise<IInvoiceReminderSweepReport> {
		const report: IInvoiceReminderSweepReport = { checked: 0, reminded: 0, blocked: 0, failed: 0 };
		if (!(await this.isTemplateSeeded())) {
			this.logger.warn(
				`The "${EmailTemplateEnum.INVOICE_REMINDER}" email template is not seeded: no payment reminder is sent until its migration runs.`
			);
			return report;
		}
		const startedAt = Date.now();
		const readStartedAt = this.unfinished?.startedAt ?? now;
		let after = this.unfinished?.after ?? null;
		for (;;) {
			const page = await this.invoicesThatMayBeDue(after, INVOICE_REMINDER_SWEEP_PAGE_SIZE, now, readStartedAt);
			report.checked += page.length;
			if (page.length) {
				await this.remindPage(page, now, report);
				after = page[page.length - 1];
			}
			if (page.length < INVOICE_REMINDER_SWEEP_PAGE_SIZE) {
				this.unfinished = null;
				break;
			}
			if (Date.now() - startedAt >= budgetMs) {
				this.unfinished = { after, startedAt: readStartedAt };
				break;
			}
		}
		if (report.reminded || report.blocked || report.failed) {
			this.logger.log(
				`Payment reminders: ${report.reminded} sent, ${report.blocked} to a blocked domain, ${report.failed} failed, ${report.checked} invoice(s) read`
			);
		}
		return report;
	}

	/** Whether the default `invoice-reminder` template is in the database, in English, the language every one falls back to. */
	private async isTemplateSeeded(): Promise<boolean> {
		const found = await this.dataSource.getRepository(EmailTemplate).count({
			where: {
				name: `${EmailTemplateEnum.INVOICE_REMINDER}/html`,
				languageCode: LanguagesEnum.ENGLISH,
				organizationId: IsNull(),
				tenantId: IsNull()
			}
		});
		return found > 0;
	}

	/**
	 * A page of the invoices that may be due a reminder at `now` (see `remindedInvoices`), due between the last step's
	 * grace and the first step's moment. Only the invoices of the read of the list it belongs to, which started at
	 * `readStartedAt`: created by then, and due no later than the window's latest due date then, so a read ends however
	 * many invoices are created or come into the window meanwhile. Ordered by due date, then id, so the next page starts
	 * after this one.
	 */
	private async invoicesThatMayBeDue(
		after: IInvoiceReminderInvoiceRow | null,
		limit: number,
		now: Date,
		readStartedAt: Date
	): Promise<IInvoiceReminderInvoiceRow[]> {
		const latest = Math.min(latestRemindedDueDate(now).getTime(), latestRemindedDueDate(readStartedAt).getTime());
		const query = this.remindedInvoices()
			.andWhere('invoice.dueDate >= :earliest', { earliest: earliestRemindedDueDate(now) })
			.andWhere('invoice.dueDate <= :latest', { latest: new Date(latest) })
			.andWhere('invoice.createdAt <= :readStartedAt', { readStartedAt })
			.orderBy('invoice.dueDate', 'ASC')
			.addOrderBy('invoice.id', 'ASC')
			.limit(limit);
		if (after) {
			query.andWhere(
				new Brackets((next) =>
					next
						.where('invoice.dueDate > :afterDueDate', { afterDueDate: after.dueDate })
						.orWhere('invoice.dueDate = :afterDueDate AND invoice.id > :afterId', { afterId: after.id })
				)
			);
		}
		return query.getRawMany<IInvoiceReminderInvoiceRow>();
	}

	/** The invoice as it is now, if it is still one the reminders go to (see `remindedInvoices`), or null. */
	private async currentInvoice(invoice: IInvoiceReminderInvoiceRow): Promise<IInvoiceReminderInvoiceRow | null> {
		const current = await this.remindedInvoices()
			.andWhere('invoice.id = :id', { id: invoice.id })
			.andWhere('invoice.tenantId = :tenantId', { tenantId: invoice.tenantId })
			.getRawOne<IInvoiceReminderInvoiceRow>();
		return current ?? null;
	}

	/**
	 * The invoices the reminders go to: sent and not paid in full, not an estimate, not archived, with a due date, of an
	 * active organization of their own tenant that turned the reminders on.
	 */
	private remindedInvoices(): SelectQueryBuilder<Invoice> {
		return this.dataSource
			.getRepository(Invoice)
			.createQueryBuilder('invoice')
			.innerJoin(
				Organization,
				'organization',
				'organization.id = invoice.organizationId AND organization.tenantId = invoice.tenantId'
			)
			.select('invoice.id', 'id')
			.addSelect('invoice.tenantId', 'tenantId')
			.addSelect('invoice.organizationId', 'organizationId')
			.addSelect('invoice.invoiceNumber', 'invoiceNumber')
			.addSelect('invoice.dueDate', 'dueDate')
			.addSelect('invoice.totalValue', 'totalValue')
			.addSelect('invoice.alreadyPaid', 'alreadyPaid')
			.addSelect('invoice.currency', 'currency')
			.addSelect('invoice.token', 'token')
			.addSelect('invoice.toContactId', 'toContactId')
			.addSelect('organization.timeZone', 'timeZone')
			.where('organization.invoiceRemindersEnabled = :enabled', { enabled: true })
			.andWhere('organization.deletedAt IS NULL')
			.andWhere('organization.isActive = :active', { active: true })
			.andWhere(
				new Brackets((archived) =>
					archived
						.where('organization.isArchived IS NULL')
						.orWhere('organization.isArchived = :archived', { archived: false })
				)
			)
			.andWhere('invoice.deletedAt IS NULL')
			.andWhere('invoice.tenantId IS NOT NULL')
			.andWhere('invoice.organizationId IS NOT NULL')
			.andWhere('invoice.status IN (:...statuses)', { statuses: [...INVOICE_REMINDER_STATUSES] })
			.andWhere(
				new Brackets((estimate) =>
					estimate
						.where('invoice.isEstimate IS NULL')
						.orWhere('invoice.isEstimate = :estimate', { estimate: false })
				)
			)
			.andWhere(
				new Brackets((paid) =>
					paid.where('invoice.paid IS NULL').orWhere('invoice.paid = :paid', { paid: false })
				)
			)
			.andWhere(
				new Brackets((archived) =>
					archived
						.where('invoice.isArchived IS NULL')
						.orWhere('invoice.isArchived = :archived', { archived: false })
				)
			)
			.andWhere('invoice.dueDate IS NOT NULL');
	}

	/** Sends the reminders a page of invoices is due. */
	private async remindPage(
		page: IInvoiceReminderInvoiceRow[],
		now: Date,
		report: IInvoiceReminderSweepReport
	): Promise<void> {
		const ids = page.map((invoice) => invoice.id);
		const deliveries = await this.lastDeliveriesOf(page);
		const claims = await this.claimsOf(ids);
		let organizations: Map<string, IOrganization> | null = null;
		let contactNames: Map<string, string> | null = null;

		for (const invoice of page) {
			const delivery = deliveries.get(String(invoice.id));
			if (!delivery) {
				continue;
			}
			const due = invoiceReminderDueAt(invoice.dueDate, delivery.emailedAt, now, invoiceTimeZoneOf(invoice));
			const left = amountLeftToPay(invoice.totalValue, invoice.alreadyPaid);
			if (!due || left === null) {
				continue;
			}
			const dueDate = instantOf(invoice.dueDate);
			const ofInvoice = claims.get(String(invoice.id)) ?? [];
			// Claimed already: this step, or a later one, of the same due date
			if (ofInvoice.some((claim) => instantOf(claim.dueDate) === dueDate && Number(claim.step) >= due.step)) {
				continue;
			}
			// What the email says beyond the invoice row, read once for the page and only when something is due
			organizations ??= await this.organizationsOf(page);
			contactNames ??= await this.contactNamesOf(page);
			const organization = organizations.get(String(invoice.organizationId));
			if (!organization) {
				continue;
			}
			try {
				const claim = await this.claim(invoice, due, delivery.email, now);
				if (claim) {
					await runInMikroOrmContext(this.orm, () =>
						this.send(invoice, due, delivery, organization, contactNames, claim, now, report)
					);
				}
			} catch (error) {
				report.failed += 1;
				this.logger.warn(
					`Payment reminder ${due.step} of invoice ${invoice.invoiceNumber} was not sent: ${(error as Error)?.message ?? error}`
				);
			}
		}
	}

	/**
	 * Sends a claimed reminder, then records it as sent. A send that fails gives the claim back, so the next sweep tries
	 * again while the reminder is due; one to a domain the platform never emails keeps its claim, unsent, so it is not
	 * tried again.
	 *
	 * The page was read before the sends ahead of this one, and the PDF takes its time: the invoice is read again right
	 * before the email goes, and a reminder that is no longer due (the invoice was paid, voided, given another due date
	 * or emailed again, the email the page read as its last did not go after all, or its organization turned the
	 * reminders off) gives its claim back and goes nowhere.
	 */
	private async send(
		invoice: IInvoiceReminderInvoiceRow,
		due: IDueInvoiceReminder,
		delivery: IInvoiceDelivery,
		organization: IOrganization,
		contactNames: Map<string, string>,
		claim: IInvoiceReminderClaim,
		now: Date,
		report: IInvoiceReminderSweepReport
	): Promise<void> {
		const languageCode = (delivery.languageCode as LanguagesEnum) || LanguagesEnum.ENGLISH;
		let sent: boolean;
		try {
			const pdf = await this.pdfOf(invoice, languageCode);
			const current = await this.stillDue(invoice, due, delivery, now);
			if (!current) {
				await this.release(claim);
				return;
			}
			sent = await this.emails.sendInvoiceReminder({
				languageCode,
				email: delivery.email,
				organization,
				invoiceId: invoice.id,
				invoiceNumber: Number(current.invoice.invoiceNumber),
				isOverdue: due.isOverdue,
				dueDate: formatInvoiceDay(new Date(instantOf(invoice.dueDate)), organization),
				amountDue: formattedAmountOf(current.left, languageCode) ?? String(current.left),
				currency: current.invoice.currency,
				contactName: invoice.toContactId ? (contactNames.get(String(invoice.toContactId)) ?? null) : null,
				publicToken: current.invoice.token,
				pdf
			});
		} catch (error) {
			await this.release(claim);
			throw error;
		}
		if (!sent) {
			report.blocked += 1;
			return;
		}
		await this.recordSent(claim, now);
		report.reminded += 1;
	}

	/**
	 * The invoice as it is now, and what is left to pay on it, when the reminder claimed from the page is still due: the
	 * invoice is still one the reminders go to, its due date did not move, it was last emailed to the address and in the
	 * language the page read (an email row names its invoice from its creation, and forgets it when the email does not
	 * go), the same step is due (an email of the invoice sent since counts, as the rules have none go on its heels), and
	 * something is left to pay. Null otherwise.
	 */
	private async stillDue(
		invoice: IInvoiceReminderInvoiceRow,
		due: IDueInvoiceReminder,
		delivery: IInvoiceDelivery,
		now: Date
	): Promise<{ invoice: IInvoiceReminderInvoiceRow; left: number } | null> {
		const current = await this.currentInvoice(invoice);
		if (!current || instantOf(current.dueDate) !== instantOf(invoice.dueDate)) {
			return null;
		}
		const last = (await this.lastDeliveriesOf([current])).get(String(current.id));
		if (!last || last.email !== delivery.email || last.languageCode !== delivery.languageCode) {
			return null;
		}
		const again = invoiceReminderDueAt(current.dueDate, last.emailedAt, now, invoiceTimeZoneOf(current));
		const left = amountLeftToPay(current.totalValue, current.alreadyPaid);
		if (!again || again.step !== due.step || left === null) {
			return null;
		}
		return { invoice: current, left };
	}

	/**
	 * The invoice as a base64 PDF in the language of its reminder, rendered as the invoice's own email renders it, or
	 * null when it cannot be: the reminder then goes without it, and says nothing of an attachment.
	 */
	private async pdfOf(invoice: IInvoiceReminderInvoiceRow, languageCode: string): Promise<string | null> {
		try {
			const buffer = await this.invoices.generateTenantInvoicePdf(invoice.id, invoice.tenantId, languageCode);
			return buffer?.length ? buffer.toString('base64') : null;
		} catch (error) {
			this.logger.warn(
				`Payment reminder of invoice ${invoice.invoiceNumber} goes without its PDF, which could not be rendered: ${(error as Error)?.message ?? error}`
			);
			return null;
		}
	}

	/** Inserts the reminder's claim: the claim, or null when another process claimed it first. */
	private async claim(
		invoice: IInvoiceReminderInvoiceRow,
		due: IDueInvoiceReminder,
		email: string,
		now: Date
	): Promise<IInvoiceReminderClaim | null> {
		const claim: IInvoiceReminderClaim = { id: randomUUID(), step: due.step, dueDate: invoice.dueDate };
		try {
			await this.dataSource.getRepository(InvoiceReminder).insert({
				id: claim.id,
				tenantId: invoice.tenantId,
				organizationId: invoice.organizationId,
				invoiceId: invoice.id,
				step: due.step,
				// The invoice's due date as a Date, whatever form the raw read answered it in (UTC text on SQLite)
				dueDate: new Date(instantOf(invoice.dueDate)),
				email,
				claimedAt: claimTimeOf(now)
			});
			return claim;
		} catch (error) {
			if (isUniqueViolation(error)) {
				return null;
			}
			throw error;
		}
	}

	/** Records the claim as sent. If that fails, the claim stays unsent, which no sweep sends again either. */
	private async recordSent(claim: IInvoiceReminderClaim, now: Date): Promise<void> {
		try {
			await this.dataSource.getRepository(InvoiceReminder).update({ id: claim.id }, { sentAt: now });
		} catch (error) {
			this.logger.warn(
				`Payment reminder ${claim.step}'s claim ${claim.id} was not recorded as sent: ${(error as Error)?.message ?? error}`
			);
		}
	}

	/** Gives back a claim whose send failed, so the next sweep tries the reminder again. */
	private async release(claim: IInvoiceReminderClaim): Promise<void> {
		try {
			await this.dataSource.getRepository(InvoiceReminder).delete({ id: claim.id, sentAt: IsNull() });
		} catch (error) {
			this.logger.warn(
				`The claim ${claim.id} of payment reminder ${claim.step} was not given back: ${(error as Error)?.message ?? error}`
			);
		}
	}

	/**
	 * The last email of each invoice of the page that recorded where it went, read in the invoice's own tenant: the
	 * address the reminders go to, the language they are written in, and when it went.
	 */
	private async lastDeliveriesOf(page: IInvoiceReminderInvoiceRow[]): Promise<Map<string, IInvoiceDelivery>> {
		const tenantOf = new Map(page.map((invoice) => [String(invoice.id), String(invoice.tenantId)]));
		const rows = await this.dataSource.getRepository(EstimateEmail).find({
			select: { invoiceId: true, tenantId: true, email: true, languageCode: true, createdAt: true },
			where: { invoiceId: In(page.map((invoice) => invoice.id)) },
			order: { createdAt: 'DESC' },
			loadEagerRelations: false
		});
		const deliveries = new Map<string, IInvoiceDelivery>();
		for (const row of rows) {
			const invoiceId = String(row.invoiceId);
			if (deliveries.has(invoiceId) || tenantOf.get(invoiceId) !== String(row.tenantId) || !row.email) {
				continue;
			}
			deliveries.set(invoiceId, {
				email: row.email,
				languageCode: row.languageCode ?? null,
				emailedAt: row.createdAt
			});
		}
		return deliveries;
	}

	/** The claims of each invoice. */
	private async claimsOf(invoiceIds: ID[]): Promise<Map<string, IInvoiceReminderClaim[]>> {
		const rows = await this.dataSource.getRepository(InvoiceReminder).find({
			select: { id: true, invoiceId: true, step: true, dueDate: true },
			where: { invoiceId: In(invoiceIds) },
			loadEagerRelations: false
		});
		const claims = new Map<string, IInvoiceReminderClaim[]>();
		for (const row of rows) {
			const ofInvoice = claims.get(String(row.invoiceId)) ?? [];
			ofInvoice.push({ id: row.id as ID, step: Number(row.step), dueDate: row.dueDate });
			claims.set(String(row.invoiceId), ofInvoice);
		}
		return claims;
	}

	/** The organizations of the page, with what the email reads of them, each in its own tenant. */
	private async organizationsOf(page: IInvoiceReminderInvoiceRow[]): Promise<Map<string, IOrganization>> {
		const tenantOf = new Map(page.map((invoice) => [String(invoice.organizationId), String(invoice.tenantId)]));
		const rows = await this.dataSource.getRepository(Organization).find({
			select: { id: true, tenantId: true, name: true, timeZone: true, dateFormat: true },
			where: { id: In([...tenantOf.keys()]) },
			// What the email reads, and nothing the organization loads eagerly (its image)
			loadEagerRelations: false
		});
		return new Map(
			rows
				.filter((organization) => tenantOf.get(String(organization.id)) === String(organization.tenantId))
				.map((organization) => [String(organization.id), organization as IOrganization])
		);
	}

	/** The names of the page's clients, each read in its invoice's tenant. */
	private async contactNamesOf(page: IInvoiceReminderInvoiceRow[]): Promise<Map<string, string>> {
		const tenantOf = new Map(
			page
				.filter((invoice) => invoice.toContactId)
				.map((invoice) => [String(invoice.toContactId), String(invoice.tenantId)])
		);
		if (!tenantOf.size) {
			return new Map();
		}
		const rows = await this.dataSource.getRepository(OrganizationContact).find({
			select: { id: true, tenantId: true, name: true },
			where: { id: In([...tenantOf.keys()]) },
			loadEagerRelations: false
		});
		return new Map(
			rows
				.filter((contact) => contact.name && tenantOf.get(String(contact.id)) === String(contact.tenantId))
				.map((contact) => [String(contact.id), contact.name])
		);
	}
}
