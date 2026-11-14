import { InvoiceStatusTypesEnum } from '@gauzy/contracts';
import * as moment from 'moment';
import 'moment-timezone';
import { instantOf } from '../../time-tracking/timer-reminder/timer-reminder.rules';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** One payment reminder of an invoice: its number, and when it is due, in days from the invoice's due date. */
export interface IInvoiceReminderStep {
	step: number;
	daysFromDueDate: number;
}

/**
 * The payment reminders of an unpaid invoice: three days before its due date, then one, seven and fourteen days after
 * it. Each goes at the start of its calendar day in the organization's time zone, whatever time of the due day the
 * invoice holds: the add and edit forms save the end of the picked day, other writers its midnight. So "one day after"
 * is the moment the due day is over.
 */
export const INVOICE_REMINDER_STEPS: ReadonlyArray<IInvoiceReminderStep> = [
	{ step: 1, daysFromDueDate: -3 },
	{ step: 2, daysFromDueDate: 1 },
	{ step: 3, daysFromDueDate: 7 },
	{ step: 4, daysFromDueDate: 14 }
];

/**
 * How long after its moment a reminder may still go. A sweep runs every hour, so one that missed its moment by longer
 * (the reminders were turned on since, or no sweep ran) is skipped and the next goes at its own moment: turning the
 * reminders on never emails a client about every invoice of the last months at once.
 */
export const INVOICE_REMINDER_GRACE_MS = 2 * DAY_MS;

/** How long after the invoice was emailed a reminder may go at the earliest: none goes on the heels of the invoice. */
export const INVOICE_REMINDER_MIN_AFTER_EMAIL_MS = DAY_MS;

/**
 * The statuses of an invoice that was sent and is not paid in full yet. A draft was never sent; a paid, overpaid or
 * void invoice is owed nothing.
 */
export const INVOICE_REMINDER_STATUSES: ReadonlyArray<string> = [
	InvoiceStatusTypesEnum.SENT,
	InvoiceStatusTypesEnum.VIEWED,
	InvoiceStatusTypesEnum.PARTIALLY_PAID
];

/** The reminder an invoice is due now. */
export interface IDueInvoiceReminder {
	step: number;
	/** Its moment, in milliseconds. */
	at: number;
	/** Past the due date, or before it. */
	isOverdue: boolean;
}

/**
 * The reminder an invoice is due at `now`, or null: the latest step whose moment has come, unless that moment is more
 * than INVOICE_REMINDER_GRACE_MS ago, or less than INVOICE_REMINDER_MIN_AFTER_EMAIL_MS after the invoice was emailed
 * (an invoice emailed late skips the steps its email came too close to). Only the latest step is ever due, so a client
 * never gets two reminders at once.
 *
 * @param dueDate The invoice's due date, as a driver hands it (a raw SQLite read answers UTC text without its zone).
 * @param emailedAt When the invoice was last emailed to the client.
 * @param now The moment the sweep runs at.
 * @param timeZone The zone the due day is read in: the organization's (see `invoiceTimeZoneOf`), as its emails print it.
 */
export function invoiceReminderDueAt(
	dueDate: Date | string,
	emailedAt: Date | string,
	now: Date,
	timeZone: string
): IDueInvoiceReminder | null {
	const due = instantOf(dueDate);
	const emailed = instantOf(emailedAt);
	if (Number.isNaN(due) || Number.isNaN(emailed)) {
		return null;
	}
	const dueDay = moment.utc(due).tz(timeZone).startOf('day');
	let latest: IDueInvoiceReminder | null = null;
	for (const { step, daysFromDueDate } of INVOICE_REMINDER_STEPS) {
		const at = dueDay.clone().add(daysFromDueDate, 'days').valueOf();
		if (at <= now.getTime()) {
			latest = { step, at, isOverdue: daysFromDueDate > 0 };
		}
	}
	if (!latest || now.getTime() - latest.at > INVOICE_REMINDER_GRACE_MS) {
		return null;
	}
	if (latest.at - emailed < INVOICE_REMINDER_MIN_AFTER_EMAIL_MS) {
		return null;
	}
	return latest;
}

/**
 * What is left to pay on an invoice, to the cent: its total less what was paid of it, or null when nothing is (no
 * total, or paid in full or more).
 */
export function amountLeftToPay(
	totalValue: number | string | null | undefined,
	alreadyPaid: number | string | null | undefined
): number | null {
	const total = Number(totalValue);
	const paid = Number(alreadyPaid ?? 0);
	if (totalValue === null || totalValue === undefined || !Number.isFinite(total) || !Number.isFinite(paid)) {
		return null;
	}
	const left = Math.round((total - paid) * 100) / 100;
	return left > 0 ? left : null;
}

/**
 * The earliest due date an invoice may have and still be due a reminder at `now`, in any time zone: the last step's,
 * plus the grace, plus the hour a clock change can add to the calendar days between. `invoiceReminderDueAt` decides.
 */
export function earliestRemindedDueDate(now: Date): Date {
	const last = INVOICE_REMINDER_STEPS[INVOICE_REMINDER_STEPS.length - 1];
	return new Date(now.getTime() - last.daysFromDueDate * DAY_MS - INVOICE_REMINDER_GRACE_MS - HOUR_MS);
}

/**
 * The latest due date an invoice may have and be due a reminder at `now`, in any time zone: the first step's, plus the
 * whole due day (the step goes at its start, the date may hold any time of it, and a clock change makes a day 25 hours
 * long), plus the hour a clock change can take from the calendar days between. `invoiceReminderDueAt` decides.
 */
export function latestRemindedDueDate(now: Date): Date {
	const first = INVOICE_REMINDER_STEPS[0];
	return new Date(now.getTime() - first.daysFromDueDate * DAY_MS + DAY_MS + 2 * HOUR_MS);
}
