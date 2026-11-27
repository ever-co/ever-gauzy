// cspell:ignore EENVELOPE EAUTH ENOAUTH EOAUTH ETLS EREQUIRETLS EMESSAGE ESTREAM EMAXLIMIT EDNS ESOCKET ECONNECTION ECONNREFUSED ENOTFOUND EPROTOCOL EHLO ERRNOS HELO greylisting
import { EmailStatusEnum, EmailTemplateEnum } from '@gauzy/contracts';

/**
 * When an email whose send failed is sent again automatically, and when it never is.
 *
 * The rules come before everything else: an email sent twice, or a burst of them, costs the platform its standing
 * with the mail providers, which a missed notification does not. So the automatic retry is narrow on purpose:
 *
 * - **Only failures that happened before the server accepted the message** ({@link classifyEmailSendError}): the
 *   connection was never made, or the server refused the session or the envelope with a transient (4xx) answer before
 *   any of the message was sent. A failure during or after `DATA`, a permanent (5xx) answer, a bad address, a
 *   credential or TLS problem, or anything that cannot be placed is never retried: the server may have accepted the
 *   message, or it would refuse it again.
 * - **Only the SMTP transport.** A provider plugin's API transport (Resend, Postmark, Mailgun, SendGrid, SES) reports
 *   no SMTP step, so whether its request reached the provider cannot be told from its error: never retried.
 * - **Only the templates listed in {@link EMAIL_RETRY_TEMPLATES}**, an allowlist: notifications with no code or link
 *   that expires, whose sender swallows the error (nobody was told it failed, so nobody resends it by hand).
 * - **At most {@link EMAIL_RETRY_MAX_ATTEMPTS} attempts in all**, counting the original, spaced by
 *   {@link EMAIL_RETRY_BACKOFF_MS}, and never for an email older than {@link EMAIL_RETRY_MAX_AGE_MS}.
 * - **At most {@link EMAIL_RETRY_BATCH_SIZE} claims per {@link EMAIL_RETRY_SWEEP_MS} for the whole installation**,
 *   counted in the database (`email_sent.lastRetryAt`) before each claim, whatever the number of processes sweeping and
 *   whether or not a queue runs the sweeps; sent one after another within a sweep.
 * - **The same message.** A retry sends the subject and HTML the original send handed to the transport; a message with
 *   anything a retry would not reproduce (headers, cc, bcc, reply-to, attachments, a text part of its own) is never
 *   retried ({@link isReproducibleEmailMessage}).
 * - **A switch**: `EMAIL_RETRY_ENABLED=false` ({@link isEmailRetryEnabled}).
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** The most attempts an email gets, counting the original send: the original and two automatic retries. */
export const EMAIL_RETRY_MAX_ATTEMPTS = 3;

/**
 * How long to wait before each automatic retry: the first five minutes after the original failed, the second thirty
 * minutes after the first retry failed. One entry per retry, so `EMAIL_RETRY_MAX_ATTEMPTS - 1` entries.
 */
export const EMAIL_RETRY_BACKOFF_MS: readonly number[] = Object.freeze([5 * MINUTE, 30 * MINUTE]);

/** An email older than this (from its original send) is never retried: a late notification is worth less than none. */
export const EMAIL_RETRY_MAX_AGE_MS = 2 * HOUR;

/**
 * The most retries claimed in any {@link EMAIL_RETRY_SWEEP_MS} for the whole installation, and so the most one sweep
 * reads and sends, one after another.
 *
 * Each sweep counts the rows claimed in the last period (`email_sent.lastRetryAt`, every process's claims) before each
 * claim, and stops once the count has reached this. Two processes that count at the same moment can both claim, so
 * the bound is this plus one per process sweeping at that moment beyond the first (a process sweeps one row at a
 * time): with 3 API replicas, at most 22 in a period, never 3 × 20.
 */
export const EMAIL_RETRY_BATCH_SIZE = 20;

/**
 * How often the sweep runs, and the period the cap of {@link EMAIL_RETRY_BATCH_SIZE} is counted over: at most about
 * 240 retries an hour for the whole installation, with or without a queue.
 */
export const EMAIL_RETRY_SWEEP_MS = 5 * MINUTE;

/** A sweep starts no send after this long, so it is over before the next one is asked for. */
export const EMAIL_RETRY_SWEEP_TIME_BUDGET_MS = 4 * MINUTE;

/**
 * How long after a sweep claimed an email (`email_sent.lastRetryAt`) its retry may still be going out. The sweep holds
 * no lock while it reads the mail settings and sends, so a resend by hand waits this long rather than risk a second
 * copy ({@link emailRetryInFlightUntil}). Counted from the claim, it covers the mail settings' verification and the
 * send at nodemailer's default timeouts (2 minutes to connect, 30 seconds for the greeting, 10 minutes of silence); a
 * retry still going after that is taken to be over.
 */
export const EMAIL_RETRY_IN_FLIGHT_MS = 15 * MINUTE;

/**
 * The templates whose failed email may be sent again automatically. An allowlist, so a template added later is never
 * retried until someone decides it may be.
 *
 * Each is a notification that carries no code or link that expires, and whose sender logs the failure and tells no
 * one, so no person sends it again by hand:
 *
 * - `welcome-user`, the welcome email;
 * - `employee-join`, "an employee joined your organization";
 * - `timesheet-submit`, the confirmation that a timesheet was submitted;
 * - `estimate-answered`, "the client accepted / declined the estimate".
 *
 * Deliberately left out:
 *
 * - every sign-in, password reset, email verification, email change, team join and account deletion email: a code or
 *   link that expires, or one superseded by the next request;
 * - the invitations, invoices, estimates, payment receipts and candidate rejections: their sender reports the failure
 *   to the person who sent them, who may send them again (a retry would make it twice), and the invoices carry a PDF
 *   the history does not keep;
 * - the payment reminders: their own sweep sends a failed reminder again;
 * - `timesheet-action` and `email-appointment`: a later approval, rejection or cancellation can make a late copy say
 *   something that is no longer true;
 * - anything sent without being recorded in `email_sent` (the account deletion emails, the Inbox emails).
 */
export const EMAIL_RETRY_TEMPLATES: ReadonlySet<string> = Object.freeze(
	new Set<string>([
		EmailTemplateEnum.WELCOME_USER,
		EmailTemplateEnum.EMPLOYEE_JOIN,
		EmailTemplateEnum.TIME_SHEET_SUBMIT,
		EmailTemplateEnum.ESTIMATE_ANSWERED
	])
) as ReadonlySet<string>;

/**
 * Whether a template's failed email may be retried. Takes the template as a sender names it (`welcome-user`) or as
 * the email history stores it (`welcome-user/html`).
 *
 * @param template The template name.
 */
export function isEmailRetryTemplate(template: string | null | undefined): boolean {
	if (typeof template !== 'string' || !template) {
		return false;
	}
	return EMAIL_RETRY_TEMPLATES.has(template.endsWith('/html') ? template.slice(0, -'/html'.length) : template);
}

/**
 * Whether failed emails are retried automatically: `EMAIL_RETRY_ENABLED`, on by default.
 *
 * Unset, empty and `true` keep it on; `false` turns it off, both the scheduling of a retry when a send fails and the
 * sweep that sends them. Any other value turns it off too (a typo of the switch's off value must not keep mail going
 * out) and is reported through `warn`, without repeating the value.
 *
 * @param env The environment.
 * @param warn Told when the value is neither `true` nor `false`.
 */
export function isEmailRetryEnabled(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = () => undefined
): boolean {
	const raw = env['EMAIL_RETRY_ENABLED']?.trim().toLowerCase();
	if (raw === undefined || raw === '' || raw === 'true') {
		return true;
	}
	if (raw !== 'false') {
		warn('EMAIL_RETRY_ENABLED is neither "true" nor "false"; failed emails are not retried.');
	}
	return false;
}

/**
 * When the next automatic retry is due.
 *
 * @param retriesMade The automatic retries already made (0 after the original send failed).
 * @param failedAt When the last attempt failed.
 * @returns The moment, or null when no retry is left.
 */
export function emailRetryDueAt(retriesMade: number, failedAt: Date): Date | null {
	if (!Number.isInteger(retriesMade) || retriesMade < 0 || retriesMade >= EMAIL_RETRY_MAX_ATTEMPTS - 1) {
		return null;
	}
	const delay = EMAIL_RETRY_BACKOFF_MS[retriesMade];
	return delay === undefined ? null : new Date(failedAt.getTime() + delay);
}

/**
 * Until when an automatic retry of an email may still be going out, so that a resend by hand must wait: `null` when
 * none can be.
 *
 * A sweep's claim leaves the row `FAILED` with no retry due and `lastRetryAt` stamped, and the row stays so while the
 * sweep reads the mail settings and sends; once it is over the row is `SENT`, due again, or failed for good. The last
 * reads the same as a retry still going, so it waits the same, until {@link EMAIL_RETRY_IN_FLIGHT_MS} after the claim.
 * A claim moment that cannot be read is no claim.
 *
 * @param row The email as it was read.
 * @param now The moment of the resend.
 */
export function emailRetryInFlightUntil(
	row: { status?: unknown; nextRetryAt?: Date | string | null; lastRetryAt?: Date | string | null },
	now: Date
): Date | null {
	if (row.status !== EmailStatusEnum.FAILED || row.nextRetryAt || !row.lastRetryAt) {
		return null;
	}
	const claimedAt = storedInstantOf(row.lastRetryAt);
	if (!Number.isFinite(claimedAt)) {
		return null;
	}
	const until = claimedAt + EMAIL_RETRY_IN_FLIGHT_MS;
	return until > now.getTime() ? new Date(until) : null;
}

/** A date and time with no zone, as SQLite keeps one (`2026-12-01 10:00:00.000`). */
const ZONELESS_DATE_TIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;

/**
 * The epoch milliseconds of a moment as the store answers it: a `Date`, or text. The store keeps these moments in
 * UTC, so text without a zone (SQLite's, where a column's type is not known to the mapping) is read as UTC rather than
 * as the local time JavaScript would take it for. NaN when it cannot be read.
 */
function storedInstantOf(value: Date | string): number {
	if (value instanceof Date) {
		return value.getTime();
	}
	const text = String(value).trim();
	return new Date(ZONELESS_DATE_TIME.test(text) ? `${text.replace(' ', 'T')}Z` : text).getTime();
}

/** The name nodemailer's own SMTP transport reports (its pooled variant is `SMTP (pool)`, which is not used here). */
export const SMTP_TRANSPORT_NAME = 'SMTP';

/** nodemailer's mailer, as an email-templates instance keeps it. */
export interface ISmtpMailer {
	transporter: { name?: unknown };
	sendMail(message: unknown): Promise<unknown>;
}

/**
 * The mailer of an `Email` instance (email-templates keeps it at `config.transport`) when it sends over nodemailer's
 * SMTP transport; null when it sends through anything else: a provider plugin's API transport, a pooled SMTP
 * transport, or a stand-in.
 *
 * @param instance The `Email` instance.
 */
export function smtpTransportOf(instance: unknown): ISmtpMailer | null {
	const transport = (instance as { config?: { transport?: Partial<ISmtpMailer> } } | null)?.config?.transport;
	if (!transport || typeof transport.sendMail !== 'function' || transport.transporter?.name !== SMTP_TRANSPORT_NAME) {
		return null;
	}
	return transport as ISmtpMailer;
}

/** Transient SMTP answers RFC 5321 gives before a message is accepted: service closing, mailbox busy, local error, storage. */
const TRANSIENT_RESPONSE_CODES: ReadonlySet<number> = new Set([421, 450, 451, 452]);

/**
 * The operating-system errors of a connection that was never made: the address was refused, or the host name could not
 * be resolved. None can happen once a connection exists. `ECONNRESET`, `EPIPE` and a TCP-level `ETIMEDOUT` can, so
 * they are not here.
 */
const NEVER_CONNECTED_ERRNOS: ReadonlySet<string> = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']);

/**
 * The timeouts nodemailer raises before the session has started: connecting (`CONNECT_TIMEOUT`, which covers the DNS
 * lookup and a TLS handshake on an implicitly secure port) and waiting for the server's greeting (`GREETING_TIMEOUT`).
 * Its idle timeout (`SOCKET_TIMEOUT`) can fire at any step, after `DATA` included.
 */
const PRE_SESSION_TIMEOUTS: ReadonlySet<string> = new Set(['CONNECT_TIMEOUT', 'GREETING_TIMEOUT']);

/** Errors that are never retried, whatever step they came from: credentials, TLS, and the message itself. */
const NEVER_RETRIED_CODES: ReadonlySet<string> = new Set([
	'EAUTH',
	'ENOAUTH',
	'EOAUTH2',
	'ETLS',
	'EREQUIRETLS',
	'EMESSAGE',
	'ESTREAM',
	'EMAXLIMIT'
]);

/** The SMTP commands of the session before the envelope: a transient answer to one of them means nothing was sent. */
const SESSION_COMMANDS: ReadonlySet<string> = new Set(['EHLO', 'HELO']);

/**
 * The envelope's commands: a transient answer to one of them comes before any of the message is sent.
 *
 * nodemailer reports every refusal of `MAIL FROM` or `RCPT TO` as `EENVELOPE`, the code a bad address has too. A
 * 421/450/451/452 there is greylisting, a busy mailbox or a full queue: the standard case for a later retry (an MTA
 * retries it for days), and `DATA` was never sent. So `EENVELOPE` is retried with one of those answers to one of these
 * two commands, and never otherwise (a 5xx, an address nodemailer refused itself at `API`, or any other step).
 */
const ENVELOPE_COMMANDS: ReadonlySet<string> = new Set(['MAIL FROM', 'RCPT TO']);

/** What {@link classifyEmailSendError} decided. */
export interface IEmailSendErrorVerdict {
	/** Whether the email may be sent again. */
	readonly retry: boolean;
	/** Why, in a few words, for the log. */
	readonly reason: string;
}

const NO = (reason: string): IEmailSendErrorVerdict => ({ retry: false, reason });
const YES = (reason: string): IEmailSendErrorVerdict => ({ retry: true, reason });

/**
 * Whether a failed SMTP send may be retried: only when the failure certainly came before the server accepted the
 * message. Pure; reads only the fields nodemailer sets on its errors (`code`, `originalCode`, `command`,
 * `responseCode`, `timeoutType`, and the start of `message` for the greeting).
 *
 * Retried:
 *
 * - the host name could not be resolved (`EDNS`), or the connection was refused or its host not found (`ESOCKET` /
 *   `ECONNECTION` whose `originalCode` is `ECONNREFUSED`, `ENOTFOUND` or `EAI_AGAIN`), at `CONN`;
 * - the connection or the greeting timed out (`ETIMEDOUT` with `timeoutType` `CONNECT_TIMEOUT` / `GREETING_TIMEOUT`);
 * - the greeting, `EHLO` / `HELO`, `MAIL FROM` or `RCPT TO` was answered 421, 450, 451 or 452.
 *
 * 🛑 **`command: 'CONN'` alone does not mean "before the session".** nodemailer reports a dropped connection
 * (`ECONNECTION`), a socket error (`ESOCKET`) and its idle timeout (`ETIMEDOUT` / `SOCKET_TIMEOUT`) with `command`
 * `CONN` at whatever step they happen, after the message body included, when the server may already have accepted
 * it. Those are retried only when another field proves the connection never existed.
 *
 * Never retried: any 5xx; `EENVELOPE` other than a 4xx to `MAIL FROM` / `RCPT TO` (a bad address); `EAUTH`; TLS and
 * certificate errors; anything during or after `DATA`; a missing or unknown `command`; anything that is not an object
 * with a string `code`.
 *
 * @param error What the send threw.
 */
export function classifyEmailSendError(error: unknown): IEmailSendErrorVerdict {
	if (!error || typeof error !== 'object') {
		return NO('no error details');
	}
	const err = error as {
		code?: unknown;
		originalCode?: unknown;
		command?: unknown;
		responseCode?: unknown;
		timeoutType?: unknown;
		message?: unknown;
	};
	const code = typeof err.code === 'string' ? err.code : undefined;
	const command = typeof err.command === 'string' ? err.command : undefined;
	if (!code) {
		return NO('no error code');
	}
	if (!command) {
		return NO('no SMTP command');
	}
	const responseCode = typeof err.responseCode === 'number' ? err.responseCode : undefined;
	if (responseCode !== undefined && responseCode >= 500) {
		return NO('permanent answer');
	}
	if (NEVER_RETRIED_CODES.has(code)) {
		return NO('credentials, TLS or message error');
	}
	if (command === 'DATA' || command === 'API' || command === 'STARTTLS' || command.startsWith('AUTH')) {
		return NO(`failed at ${command}`);
	}

	if (command === 'CONN') {
		if (code === 'EDNS') {
			return YES('host name not resolved');
		}
		const errno = typeof err.originalCode === 'string' ? err.originalCode : code;
		if ((code === 'ESOCKET' || code === 'ECONNECTION' || code === errno) && NEVER_CONNECTED_ERRNOS.has(errno)) {
			return YES('connection never made');
		}
		if (code === 'ETIMEDOUT' && typeof err.timeoutType === 'string' && PRE_SESSION_TIMEOUTS.has(err.timeoutType)) {
			return YES('connection or greeting timed out');
		}
		if (
			code === 'EPROTOCOL' &&
			responseCode !== undefined &&
			TRANSIENT_RESPONSE_CODES.has(responseCode) &&
			typeof err.message === 'string' &&
			err.message.startsWith('Invalid greeting')
		) {
			return YES('greeting refused for now');
		}
		return NO('connection error at an unknown step');
	}

	if (responseCode === undefined || !TRANSIENT_RESPONSE_CODES.has(responseCode)) {
		return NO('not a transient answer');
	}
	if (SESSION_COMMANDS.has(command)) {
		return YES(`${command} refused for now`);
	}
	if (code === 'EENVELOPE' && ENVELOPE_COMMANDS.has(command)) {
		return YES(`${command} refused for now`);
	}
	return NO(`unknown step ${command}`);
}

/**
 * The fields of a message as email-templates hands it to the transport that a retry reproduces: the recipient, the
 * subject and the HTML kept on the row, the text part email-templates derives from that HTML again, the sender the
 * row's mail settings give again, and the empty attachment list email-templates always sets.
 */
const REPRODUCED_MESSAGE_FIELDS: ReadonlySet<string> = new Set([
	'from',
	'to',
	'subject',
	'html',
	'text',
	'attachments'
]);

/**
 * Whether a retry would send this message as it was: one recipient, a subject and an HTML part, the mail settings'
 * own sender, no attachment, and no other field. Headers (link tracking off, for one), cc, bcc, reply-to, a sender of
 * the email's own or an attachment would be lost on the retry, which sends only what the row keeps, so a message with
 * any of them is not retried. The text part is checked by the caller, which derives it again from the HTML.
 *
 * Reads field names and shapes only; never keeps a value.
 *
 * @param message The message as email-templates handed it to the transport.
 * @param defaultFrom The sender of the mail settings the message went through (`config.message.from`).
 */
export function isReproducibleEmailMessage(message: unknown, defaultFrom: unknown): boolean {
	if (!message || typeof message !== 'object' || Array.isArray(message)) {
		return false;
	}
	for (const [field, value] of Object.entries(message)) {
		if (value !== undefined && !REPRODUCED_MESSAGE_FIELDS.has(field)) {
			return false;
		}
	}
	const { from, to, subject, html, attachments } = message as Record<string, unknown>;
	return (
		typeof to === 'string' &&
		!!to &&
		!to.includes(',') &&
		typeof subject === 'string' &&
		typeof html === 'string' &&
		html.trim().length > 0 &&
		from === defaultFrom &&
		(attachments === undefined || (Array.isArray(attachments) && attachments.length === 0))
	);
}

/** The longest {@link emailSendErrorCode} answer, which is what `email_sent.lastErrorCode` keeps. */
const MAX_ERROR_CODE_LENGTH = 64;

/**
 * A short, address-free label of a send error for `email_sent.lastErrorCode`: the error code, the SMTP answer code and
 * the SMTP step, such as `EENVELOPE 451 RCPT TO` or `ESOCKET ECONNREFUSED CONN`. Built from those fields only, and only
 * when each has the shape nodemailer gives it, so a provider's free text (which can name the recipient) never gets in.
 *
 * @param error What the send threw.
 * @returns The label; `UNKNOWN` when the error has no code of that shape.
 */
export function emailSendErrorCode(error: unknown): string {
	const err = (error && typeof error === 'object' ? error : {}) as {
		code?: unknown;
		originalCode?: unknown;
		responseCode?: unknown;
		command?: unknown;
	};
	const token = (value: unknown, pattern: RegExp): string | undefined =>
		typeof value === 'string' && pattern.test(value) ? value : undefined;
	const code = token(err.code, /^[A-Z][A-Z0-9_]{1,31}$/);
	if (!code) {
		return 'UNKNOWN';
	}
	const parts = [code];
	const originalCode = token(err.originalCode, /^[A-Z][A-Z0-9_]{1,31}$/);
	if (originalCode && originalCode !== code) {
		parts.push(originalCode);
	}
	if (
		typeof err.responseCode === 'number' &&
		Number.isInteger(err.responseCode) &&
		err.responseCode >= 100 &&
		err.responseCode < 600
	) {
		parts.push(String(err.responseCode));
	}
	const command = token(err.command, /^[A-Z][A-Z0-9 -]{0,23}$/);
	if (command) {
		parts.push(command);
	}
	return parts.join(' ').slice(0, MAX_ERROR_CODE_LENGTH);
}
