// cspell:ignore EENVELOPE EAUTH
/**
 * Helpers for reporting a failed email send without leaking who it was for.
 *
 * Mail providers put recipient addresses into their error text. Postmark's SMTP rejection for an
 * inactive recipient, for example, ends with "Found inactive addresses: <the address>", and
 * nodemailer copies the provider's reply into `error.message` and `error.response`. Logging the error
 * object as-is (which is what every sender here used to do) therefore writes customer addresses into
 * the pod logs. These helpers keep the parts an operator needs - the provider's code, the SMTP reply
 * code and the SMTP command it failed on - and mask every address in the free text.
 */

/**
 * Anything that looks like `local@domain`. Deliberately loose: over-masking a log line costs
 * nothing, while under-masking leaks an address. The domain may not end in a dot, so the full stop
 * after an address at the end of a sentence stays in the text.
 */
const EMAIL_ADDRESS_PATTERN = /[^\s@<>"'(),;:[\]]+@[^\s@<>"'(),;:[\]]*[^\s@<>"'(),;:[\].]/g;

/** Keeps a single log line readable even when a provider returns a whole HTML error page. */
const MAX_MESSAGE_LENGTH = 500;

/**
 * Replaces every email address in `text` with `<redacted-email>`.
 *
 * @param text Free text that may contain email addresses.
 * @returns The same text with every address masked.
 */
export function redactEmailAddresses(text: string): string {
	if (typeof text !== 'string' || !text) {
		return '';
	}
	return text.replace(EMAIL_ADDRESS_PATTERN, '<redacted-email>');
}

/**
 * One log-safe line describing why an email send failed.
 *
 * Reads the fields nodemailer and email-templates set (`code` such as `EAUTH`/`EENVELOPE`/`ETIMEDOUT`,
 * `responseCode` such as 550, `command` such as `RCPT TO`) plus the message, with every address
 * masked. Never includes the recipient.
 *
 * @param error Whatever was thrown by the send.
 * @returns For example `code=EENVELOPE responseCode=406 command=RCPT TO message="..."`.
 */
export function describeEmailSendError(error: unknown): string {
	if (error === null || error === undefined) {
		return 'unknown error';
	}
	if (typeof error !== 'object') {
		return `message="${truncate(redactEmailAddresses(String(error)))}"`;
	}

	const err = error as {
		name?: unknown;
		code?: unknown;
		responseCode?: unknown;
		command?: unknown;
		message?: unknown;
		response?: unknown;
	};
	const parts: string[] = [];

	if (typeof err.name === 'string' && err.name && err.name !== 'Error') {
		parts.push(`name=${err.name}`);
	}
	if (typeof err.code === 'string' || typeof err.code === 'number') {
		parts.push(`code=${err.code}`);
	}
	if (typeof err.responseCode === 'number' || typeof err.responseCode === 'string') {
		parts.push(`responseCode=${err.responseCode}`);
	}
	if (typeof err.command === 'string' && err.command) {
		parts.push(`command=${err.command}`);
	}

	const message =
		typeof err.message === 'string' && err.message
			? err.message
			: typeof err.response === 'string'
				? err.response
				: '';
	if (message) {
		parts.push(`message="${truncate(redactEmailAddresses(message))}"`);
	}

	return parts.length ? parts.join(' ') : 'unknown error';
}

function truncate(text: string): string {
	const singleLine = text.replace(/\s+/g, ' ').trim();
	return singleLine.length > MAX_MESSAGE_LENGTH ? `${singleLine.slice(0, MAX_MESSAGE_LENGTH)}...` : singleLine;
}
