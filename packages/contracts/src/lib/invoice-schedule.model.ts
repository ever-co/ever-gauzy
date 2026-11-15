/**
 * Contract for invoice schedules: a client billed on a schedule. On each date of the schedule, the API builds the
 * invoice of that client for the period just ended, from the billable time not billed yet, priced as a manual invoice,
 * and saves it as a draft or sends it. Each run is recorded: when it ran, which invoice it made, or why it made none.
 */

import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IInvoice } from './invoice.model';
import { IOrganizationContact } from './organization-contact.model';
import { IUser } from './user.model';

/** How often a schedule bills its client. */
export enum InvoiceScheduleFrequencyEnum {
	WEEKLY = 'WEEKLY',
	BIWEEKLY = 'BIWEEKLY',
	MONTHLY = 'MONTHLY'
}

/** How a scheduled invoice groups its lines, as the manual invoice offers: by project, by member, or by task. */
export enum InvoiceScheduleGroupingEnum {
	PROJECT = 'PROJECT',
	MEMBER = 'MEMBER',
	TASK = 'TASK'
}

/** Where a run stands, or how it ended. */
export enum InvoiceScheduleRunStatusEnum {
	/** Claimed by a sweep, which is building the invoice now. */
	CLAIMED = 'CLAIMED',
	/** The invoice was made and kept as a draft. */
	DRAFTED = 'DRAFTED',
	/** The invoice was made, emailed to the client with its PDF, and marked Sent. */
	SENT = 'SENT',
	/** The invoice was made, but could not be emailed: it is kept as a draft (see `reason`). */
	NOT_SENT = 'NOT_SENT',
	/** The period had no billable time left to bill: no invoice. */
	NO_TIME = 'NO_TIME',
	/** No invoice could be made (see `reason`). */
	FAILED = 'FAILED'
}

/** Why a run made no invoice, did not send it, or left time out of it. */
export enum InvoiceScheduleRunReasonEnum {
	/** The period had no billable time that no invoice bills yet. */
	NO_BILLABLE_TIME = 'NO_BILLABLE_TIME',
	/** The period's billable time has no rate to be priced at. */
	NO_PRICED_TIME = 'NO_PRICED_TIME',
	/** Part of the time had no rate, or was priced in another currency than the invoice's: it is left for a manual invoice. */
	TIME_LEFT_OUT = 'TIME_LEFT_OUT',
	/** The person whose access the schedule runs with can no longer make invoices of this organization. */
	AUTHOR_CANNOT_INVOICE = 'AUTHOR_CANNOT_INVOICE',
	/** The client has no email address to send the invoice to. */
	CLIENT_HAS_NO_EMAIL = 'CLIENT_HAS_NO_EMAIL',
	/** The invoice's email could not be sent. */
	EMAIL_NOT_SENT = 'EMAIL_NOT_SENT',
	/** The invoice could not be saved. */
	INVOICE_NOT_SAVED = 'INVOICE_NOT_SAVED'
}

/** A period of a schedule: its first and last days, and the day its invoice is made, all `YYYY-MM-DD`. */
export interface IInvoiceSchedulePeriod {
	startDay: string;
	endDay: string;
	/** The day after the period: the invoice is made on it, in the organization's time zone. */
	runDay: string;
}

/** A client's billing schedule. */
export interface IInvoiceSchedule extends IBasePerTenantAndOrganizationEntityModel {
	/** The client billed. A client has one schedule at most. */
	organizationContactId: ID;
	organizationContact?: IOrganizationContact;
	frequency: InvoiceScheduleFrequencyEnum;
	/** The first day of the first period, `YYYY-MM-DD`: a day, not an instant, counted in the organization's zone. */
	startDay: string;
	grouping: InvoiceScheduleGroupingEnum;
	/** Whether each invoice is emailed to the client and marked Sent; kept as a draft otherwise. */
	sendInvoice: boolean;
	/** When the schedule was paused; null while it runs. A paused schedule makes no invoice. */
	pausedAt?: Date | null;
	/**
	 * Since when the schedule runs: its creation, or its last resume. A period whose invoice day came before it is not
	 * billed, so creating or resuming a schedule never bills the past.
	 */
	activeSince: Date;
	/** The user whose access the runs use: whoever created or last changed the schedule. */
	authorId?: ID | null;
	author?: IUser;
	/** The next period to be billed, and the day it will be; null while the schedule is paused. Computed when read. */
	nextPeriod?: IInvoiceSchedulePeriod | null;
	/** The schedule's latest run, with the invoice it made; null before its first. Read with the schedule. */
	lastRun?: IInvoiceScheduleRun | null;
}

/** A run of a schedule: one per period, made once whatever the processes that run the schedule. */
export interface IInvoiceScheduleRun extends IBasePerTenantAndOrganizationEntityModel {
	invoiceScheduleId: ID;
	invoiceSchedule?: IInvoiceSchedule;
	/** The first day of the period billed, `YYYY-MM-DD`. Unique per schedule. */
	periodStart: string;
	/** The last day of the period billed, `YYYY-MM-DD`, included. */
	periodEnd: string;
	status: InvoiceScheduleRunStatusEnum;
	reason?: InvoiceScheduleRunReasonEnum | null;
	/** When a sweep claimed the run. */
	claimedAt: Date;
	/** When the run ended; null while it is claimed. */
	finishedAt?: Date | null;
	/** The invoice the run made; null when it made none, or the invoice was deleted since. */
	invoiceId?: ID | null;
	invoice?: IInvoice;
	/** Billable time of the period the invoice does not bill (no rate, another currency), in seconds. */
	leftOutSeconds?: number | null;
}

/** `POST /api/invoice-schedules` */
export interface IInvoiceScheduleCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	organizationContactId: ID;
	frequency: InvoiceScheduleFrequencyEnum;
	startDay: string;
	grouping?: InvoiceScheduleGroupingEnum;
	sendInvoice?: boolean;
}

/** `PUT /api/invoice-schedules/:id`: the fields sent replace the stored ones; `paused` pauses or resumes it. */
export interface IInvoiceScheduleUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	frequency?: InvoiceScheduleFrequencyEnum;
	startDay?: string;
	grouping?: InvoiceScheduleGroupingEnum;
	sendInvoice?: boolean;
	paused?: boolean;
}

/** `GET /api/invoice-schedules`: the schedules of an organization, or of one of its clients. */
export interface IInvoiceScheduleFindInput extends IBasePerTenantAndOrganizationEntityModel {
	organizationContactId?: ID;
}
