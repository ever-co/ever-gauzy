import { EmployeeNotificationTypeEnum } from '@gauzy/contracts';

/** The queue the delivery sweep is asked on, and the job and schedule names. */
export const INBOX_DELIVERY_QUEUE_NAME = 'inbox-delivery';
export const INBOX_DELIVERY_SWEEP_JOB = 'inbox-delivery-sweep';
export const INBOX_DELIVERY_SWEEP_SCHEDULE = 'inbox-delivery-sweep';
/** The named lock one sweep holds across the workers (`InboxNamedLocks`). */
export const INBOX_DELIVERY_SWEEP_LOCK = 'inbox-delivery-sweep';
/** A sweep that could not run at all is tried again by the queue, a little later each time. */
export const INBOX_DELIVERY_SWEEP_ATTEMPTS = 3;
export const INBOX_DELIVERY_SWEEP_RETRY_DELAY_MS = 30_000;

/** How far back the intake looks for entries with no decision yet (a worker that was down catches up this far). */
export const INBOX_DELIVERY_INTAKE_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** How many entries one sweep decides, and how many due deliveries it sends (`INBOX_DELIVERY_SWEEP_BATCH`). */
export const INBOX_DELIVERY_SWEEP_BATCH_DEFAULT = 200;
/** After this many failed attempts the delivery is given up (the entry stays in the Inbox). */
export const INBOX_DELIVERY_MAX_ATTEMPTS = 5;
/** The wait before the next attempt doubles from here, up to the cap. */
export const INBOX_DELIVERY_RETRY_BASE_MS = 5 * 60 * 1000;
export const INBOX_DELIVERY_RETRY_CAP_MS = 6 * 60 * 60 * 1000;
/** The hour the digest goes out when the employee chose none (the spec's proposed default). */
export const INBOX_DELIVERY_DEFAULT_DIGEST_HOUR = 8;
/** A digest lists this many entries at most; the rest are a count and the link. */
export const INBOX_DELIVERY_DIGEST_MAX_ITEMS = 50;
/** The Inbox page, under the client's base URL. */
export const INBOX_DELIVERY_INBOX_PATH = '#/pages/inbox';
export const INBOX_DELIVERY_SETTINGS_PATH = '#/pages/settings/notifications';

/** What the subject and the digest call each kind. */
export const INBOX_DELIVERY_KIND_LABELS: Record<string, string> = {
	[EmployeeNotificationTypeEnum.PAYMENT]: 'Payment',
	[EmployeeNotificationTypeEnum.ASSIGNMENT]: 'Assignment',
	[EmployeeNotificationTypeEnum.INVITATION]: 'Invitation',
	[EmployeeNotificationTypeEnum.MENTION]: 'Mention',
	[EmployeeNotificationTypeEnum.COMMENT]: 'Comment',
	[EmployeeNotificationTypeEnum.MESSAGE]: 'Message',
	[EmployeeNotificationTypeEnum.BROADCAST]: 'Announcement',
	[EmployeeNotificationTypeEnum.RATE_CHANGE_REQUEST]: 'Rate change request',
	[EmployeeNotificationTypeEnum.TASK_UPDATE]: 'Task update'
};

/** How many entries one sweep takes in and sends, from the environment. */
export function readInboxDeliveryBatch(env: Record<string, string | undefined> = process.env): number {
	const raw = Number(env['INBOX_DELIVERY_SWEEP_BATCH']);
	return Number.isInteger(raw) && raw > 0 ? Math.min(raw, 2000) : INBOX_DELIVERY_SWEEP_BATCH_DEFAULT;
}
