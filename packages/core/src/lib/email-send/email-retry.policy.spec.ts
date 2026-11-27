// cspell:ignore EENVELOPE EAUTH ENOAUTH EOAUTH ETLS EREQUIRETLS EMESSAGE ESTREAM EMAXLIMIT EDNS ESOCKET ECONNECTION ECONNREFUSED ENOTFOUND EPROTOCOL ECONNRESET EPIPE EHOSTUNREACH ESES EFETCH BDAT EHLO HELO REQUIRETLS RSET XOAUTH flase greylisted
import { EmailStatusEnum, EmailTemplateEnum } from '@gauzy/contracts';
import {
	classifyEmailSendError,
	EMAIL_RETRY_BACKOFF_MS,
	EMAIL_RETRY_IN_FLIGHT_MS,
	EMAIL_RETRY_MAX_ATTEMPTS,
	EMAIL_RETRY_TEMPLATES,
	emailRetryDueAt,
	emailRetryInFlightUntil,
	emailSendErrorCode,
	isEmailRetryEnabled,
	isEmailRetryTemplate,
	isReproducibleEmailMessage,
	smtpTransportOf
} from './email-retry.policy';

/** An error shaped as nodemailer 10 shapes its own. */
function smtpError(fields: Record<string, unknown>, message = 'failed'): Error {
	return Object.assign(new Error(message), fields);
}

describe('classifyEmailSendError', () => {
	/**
	 * [case, error fields, message, retried]. Every row is a shape nodemailer 10.2 produces (see
	 * `email-retry.nodemailer.spec.ts` for the ones a local fake server reproduces end to end).
	 */
	const table: Array<[string, Record<string, unknown>, string, boolean]> = [
		// Before the connection existed: retried
		[
			'connection refused',
			{ code: 'ESOCKET', originalCode: 'ECONNREFUSED', command: 'CONN' },
			'connect ECONNREFUSED',
			true
		],
		[
			'host not found (socket)',
			{ code: 'ESOCKET', originalCode: 'ENOTFOUND', command: 'CONN' },
			'getaddrinfo ENOTFOUND',
			true
		],
		[
			'DNS lookup failed for now',
			{ code: 'ESOCKET', originalCode: 'EAI_AGAIN', command: 'CONN' },
			'getaddrinfo EAI_AGAIN',
			true
		],
		[
			'host name not resolved (EDNS)',
			{ code: 'EDNS', originalCode: 'ENOTFOUND', command: 'CONN' },
			'queryA ENOTFOUND',
			true
		],
		[
			'refused, reported with the system code itself',
			{ code: 'ECONNREFUSED', command: 'CONN' },
			'connect ECONNREFUSED',
			true
		],
		[
			'refused, reported as ECONNECTION',
			{ code: 'ECONNECTION', originalCode: 'ECONNREFUSED', command: 'CONN' },
			'x',
			true
		],
		[
			'connection timeout',
			{ code: 'ETIMEDOUT', timeoutType: 'CONNECT_TIMEOUT', command: 'CONN' },
			'Connection timeout',
			true
		],
		[
			'greeting timeout',
			{ code: 'ETIMEDOUT', timeoutType: 'GREETING_TIMEOUT', command: 'CONN' },
			'Greeting never received',
			true
		],
		// The session refused before the envelope: retried
		[
			'greeting 421',
			{ code: 'EPROTOCOL', responseCode: 421, command: 'CONN', response: '421 busy' },
			'Invalid greeting. response=421 busy: 421 busy',
			true
		],
		[
			'greeting 450',
			{ code: 'EPROTOCOL', responseCode: 450, command: 'CONN' },
			'Invalid greeting. response=450 x',
			true
		],
		[
			'EHLO 421',
			{ code: 'ECONNECTION', responseCode: 421, command: 'EHLO' },
			'Server terminates connection. response=421',
			true
		],
		['HELO 451', { code: 'EPROTOCOL', responseCode: 451, command: 'HELO' }, 'Invalid HELO. response=451', true],
		// The envelope refused for now, before DATA: retried
		['MAIL FROM 421', { code: 'EENVELOPE', responseCode: 421, command: 'MAIL FROM' }, 'Mail command failed', true],
		['MAIL FROM 451', { code: 'EENVELOPE', responseCode: 451, command: 'MAIL FROM' }, 'Mail command failed', true],
		['MAIL FROM 452', { code: 'EENVELOPE', responseCode: 452, command: 'MAIL FROM' }, 'Mail command failed', true],
		[
			'RCPT TO 450 (greylisted)',
			{ code: 'EENVELOPE', responseCode: 450, command: 'RCPT TO' },
			"Can't send mail - all recipients were rejected",
			true
		],
		['RCPT TO 451', { code: 'EENVELOPE', responseCode: 451, command: 'RCPT TO' }, "Can't send mail", true],
		['RCPT TO 452', { code: 'EENVELOPE', responseCode: 452, command: 'RCPT TO' }, "Can't send mail", true],

		// Any permanent answer: never
		[
			'RCPT TO 550 (no such user)',
			{ code: 'EENVELOPE', responseCode: 550, command: 'RCPT TO' },
			"Can't send mail",
			false
		],
		['MAIL FROM 553', { code: 'EENVELOPE', responseCode: 553, command: 'MAIL FROM' }, 'Mail command failed', false],
		[
			'greeting 554',
			{ code: 'EPROTOCOL', responseCode: 554, command: 'CONN' },
			'Invalid greeting. response=554',
			false
		],
		['EHLO 502 with requireTLS', { code: 'ECONNECTION', responseCode: 502, command: 'EHLO' }, 'EHLO failed', false],
		[
			'a 5xx on a step that is otherwise retried',
			{ code: 'ESOCKET', originalCode: 'ECONNREFUSED', command: 'CONN', responseCode: 554 },
			'x',
			false
		],
		// A bad address, caught before any server: never
		['no recipients', { code: 'EENVELOPE', command: 'API' }, 'No recipients defined', false],
		['invalid recipient', { code: 'EENVELOPE', command: 'API' }, 'Invalid recipient', false],
		['RCPT TO without an answer code', { code: 'EENVELOPE', command: 'RCPT TO' }, "Can't send mail", false],
		['RCPT TO 454', { code: 'EENVELOPE', responseCode: 454, command: 'RCPT TO' }, 'x', false],
		// Credentials: never
		['invalid login', { code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN' }, 'Invalid login', false],
		['temporary auth failure', { code: 'EAUTH', responseCode: 454, command: 'AUTH LOGIN' }, 'Invalid login', false],
		['missing credentials', { code: 'EAUTH', command: 'API' }, 'Missing credentials', false],
		['no auth', { code: 'ENOAUTH', command: 'CONN' }, 'x', false],
		['OAuth2', { code: 'EOAUTH2', command: 'AUTH XOAUTH2' }, 'x', false],
		// TLS and certificates: never
		[
			'STARTTLS refused for now',
			{ code: 'ETLS', responseCode: 454, command: 'STARTTLS' },
			'Error upgrading connection with STARTTLS',
			false
		],
		['TLS closed during the upgrade', { code: 'ETLS', command: 'CONN' }, 'Connection closed unexpectedly', false],
		[
			'certificate expired',
			{ code: 'ESOCKET', originalCode: 'CERT_HAS_EXPIRED', command: 'CONN' },
			'certificate has expired',
			false
		],
		[
			'self-signed certificate',
			{ code: 'ESOCKET', originalCode: 'DEPTH_ZERO_SELF_SIGNED_CERT', command: 'CONN' },
			'x',
			false
		],
		['REQUIRETLS', { code: 'EREQUIRETLS', command: 'MAIL FROM' }, 'x', false],
		// During or after DATA: never (the server may have accepted the message)
		[
			'DATA refused for now',
			{ code: 'EENVELOPE', responseCode: 451, command: 'DATA' },
			'Data command failed',
			false
		],
		[
			'message refused for now after the body',
			{ code: 'EMESSAGE', responseCode: 451, command: 'DATA' },
			'Message failed',
			false
		],
		['421 after the body', { code: 'EMESSAGE', responseCode: 421, command: 'DATA' }, 'Message failed', false],
		['message stream error', { code: 'ESTREAM', command: 'API' }, 'x', false],
		['message too large', { code: 'EMESSAGE', command: 'MAIL FROM' }, 'Message size larger than allowed', false],
		// 🛑 `CONN` at any step: never, unless another field proves the connection never existed
		[
			'connection closed (at any step, after DATA included)',
			{ code: 'ECONNECTION', command: 'CONN' },
			'Connection closed unexpectedly',
			false
		],
		[
			'server closing with 421 at an unknown step',
			{ code: 'ECONNECTION', responseCode: 421, command: 'CONN' },
			'Server closed the connection',
			false
		],
		[
			'idle timeout (at any step, after DATA included)',
			{ code: 'ETIMEDOUT', timeoutType: 'SOCKET_TIMEOUT', command: 'CONN' },
			'Timeout',
			false
		],
		['timeout without its type', { code: 'ETIMEDOUT', command: 'CONN' }, 'Timeout', false],
		[
			'TLS upgrade timeout',
			{ code: 'ETIMEDOUT', timeoutType: 'UPGRADE_TIMEOUT', command: 'CONN' },
			'TLS handshake timed out',
			false
		],
		[
			'connection reset',
			{ code: 'ESOCKET', originalCode: 'ECONNRESET', command: 'CONN' },
			'read ECONNRESET',
			false
		],
		['broken pipe', { code: 'ESOCKET', originalCode: 'EPIPE', command: 'CONN' }, 'write EPIPE', false],
		['TCP-level timeout', { code: 'ESOCKET', originalCode: 'ETIMEDOUT', command: 'CONN' }, 'x', false],
		['host unreachable', { code: 'ESOCKET', originalCode: 'EHOSTUNREACH', command: 'CONN' }, 'x', false],
		['a socket error with no system code', { code: 'ESOCKET', command: 'CONN' }, 'x', false],
		[
			'an unexpected reply, whatever its code',
			{ code: 'EPROTOCOL', responseCode: 421, command: 'CONN' },
			'Unexpected Response: 421',
			false
		],
		[
			'an oversized reply',
			{ code: 'EPROTOCOL', command: 'CONN' },
			'Server response exceeds maximum allowed size',
			false
		],
		// Unknown or absent step: never
		['no command', { code: 'ESOCKET', originalCode: 'ECONNREFUSED' }, 'connect ECONNREFUSED', false],
		['a 4xx with no command', { code: 'EENVELOPE', responseCode: 451 }, 'x', false],
		['an unknown command', { code: 'EENVELOPE', responseCode: 451, command: 'BDAT' }, 'x', false],
		['RSET', { code: 'EPROTOCOL', responseCode: 421, command: 'RSET' }, 'x', false],
		['a command that is not a string', { code: 'ESOCKET', originalCode: 'ECONNREFUSED', command: 1 }, 'x', false],
		// A provider plugin's API error (no SMTP step): never
		['an SES error', { code: 'ESES' }, 'Throttling', false],
		['an HTTP fetch error', { code: 'EFETCH' }, 'fetch failed', false],
		['an API 429', { statusCode: 429 }, 'Too Many Requests', false],
		['an API 503', { status: 503, code: 'ServiceUnavailable' }, 'x', false],
		// Not a send error at all: never
		['a render or configuration error', {}, 'SMTP configuration is not set for this tenant / organization', false],
		['a TypeError', { code: undefined }, "Cannot read properties of undefined (reading 'send')", false]
	];

	it.each(table)('%s', (_case, fields, message, retried) => {
		expect(classifyEmailSendError(smtpError(fields, message)).retry).toBe(retried);
	});

	it('answers no for anything that is not an error object', () => {
		for (const value of [undefined, null, '', 'ECONNREFUSED', 421, true, Symbol('x')]) {
			expect(classifyEmailSendError(value).retry).toBe(false);
		}
	});

	it('says why, in a few words, without the message text', () => {
		const verdict = classifyEmailSendError(
			smtpError({ code: 'EENVELOPE', responseCode: 550, command: 'RCPT TO' }, '550 no such user ada@example.test')
		);
		expect(verdict).toEqual({ retry: false, reason: 'permanent answer' });
	});
});

describe('emailSendErrorCode', () => {
	it.each([
		[{ code: 'ESOCKET', originalCode: 'ECONNREFUSED', command: 'CONN' }, 'ESOCKET ECONNREFUSED CONN'],
		[{ code: 'EENVELOPE', responseCode: 451, command: 'RCPT TO' }, 'EENVELOPE 451 RCPT TO'],
		[{ code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN' }, 'EAUTH 535 AUTH PLAIN'],
		[{ code: 'ECONNREFUSED', originalCode: 'ECONNREFUSED' }, 'ECONNREFUSED'],
		[{ code: 'EDNS', command: 'CONN' }, 'EDNS CONN']
	])('labels %j as %s', (fields, label) => {
		expect(emailSendErrorCode(smtpError(fields))).toBe(label);
	});

	it('never takes free text, which can name the recipient', () => {
		const label = emailSendErrorCode(
			smtpError(
				{
					code: 'EENVELOPE',
					responseCode: 550,
					command: 'RCPT TO <ada@example.test>',
					response: '550 ada@example.test'
				},
				'550 Found inactive addresses: ada@example.test'
			)
		);
		expect(label).toBe('EENVELOPE 550');
		expect(emailSendErrorCode(smtpError({ code: 'bad code ada@example.test' }))).toBe('UNKNOWN');
		expect(emailSendErrorCode(smtpError({ code: 'ESOCKET', originalCode: 'ada@example.test' }))).toBe('ESOCKET');
		expect(emailSendErrorCode(smtpError({ code: 'ESOCKET', responseCode: 99999 }))).toBe('ESOCKET');
		expect(emailSendErrorCode('ada@example.test')).toBe('UNKNOWN');
		expect(emailSendErrorCode(undefined)).toBe('UNKNOWN');
	});

	it('keeps the label to 64 characters', () => {
		const label = emailSendErrorCode(
			smtpError({ code: 'E'.repeat(32), originalCode: 'F'.repeat(32), responseCode: 451, command: 'RCPT TO' })
		);
		expect(label.length).toBeLessThanOrEqual(64);
	});
});

describe('the retried templates', () => {
	it('are the four notifications, an allowlist', () => {
		expect([...EMAIL_RETRY_TEMPLATES].sort()).toEqual(
			[
				EmailTemplateEnum.EMPLOYEE_JOIN,
				EmailTemplateEnum.ESTIMATE_ANSWERED,
				EmailTemplateEnum.TIME_SHEET_SUBMIT,
				EmailTemplateEnum.WELCOME_USER
			].sort()
		);
	});

	it('are read as a sender names them and as the email history stores them', () => {
		expect(isEmailRetryTemplate('welcome-user')).toBe(true);
		expect(isEmailRetryTemplate('welcome-user/html')).toBe(true);
		expect(isEmailRetryTemplate('welcome-user/subject')).toBe(false);
		expect(isEmailRetryTemplate('')).toBe(false);
		expect(isEmailRetryTemplate(undefined)).toBe(false);
		expect(isEmailRetryTemplate(null)).toBe(false);
	});

	it.each([
		EmailTemplateEnum.PASSWORD_RESET,
		EmailTemplateEnum.MULTI_TENANT_PASSWORD_RESET,
		EmailTemplateEnum.PASSWORD_LESS_AUTHENTICATION,
		EmailTemplateEnum.EMAIL_VERIFICATION,
		EmailTemplateEnum.EMAIL_RESET,
		EmailTemplateEnum.ORGANIZATION_TEAM_JOIN_REQUEST,
		EmailTemplateEnum.ACCOUNT_DELETION_REQUEST,
		EmailTemplateEnum.ACCOUNT_DELETION_COMPLETED,
		EmailTemplateEnum.INVITE_USER,
		EmailTemplateEnum.INVITE_EMPLOYEE,
		EmailTemplateEnum.INVITE_GAUZY_TEAMS,
		EmailTemplateEnum.INVITE_ORGANIZATION_CLIENT,
		EmailTemplateEnum.EMAIL_INVOICE,
		EmailTemplateEnum.EMAIL_ESTIMATE,
		EmailTemplateEnum.INVOICE_REMINDER,
		EmailTemplateEnum.PAYMENT_RECEIPT,
		EmailTemplateEnum.REJECT_CANDIDATE,
		EmailTemplateEnum.TIME_SHEET_ACTION,
		EmailTemplateEnum.INBOX_NOTIFICATION,
		EmailTemplateEnum.INBOX_DIGEST,
		'email-appointment'
	])('never retries %s', (template) => {
		expect(isEmailRetryTemplate(template)).toBe(false);
		expect(isEmailRetryTemplate(`${template}/html`)).toBe(false);
	});

	it('leaves out every template added to the enum later, until someone lists it', () => {
		const listed = new Set<string>([...EMAIL_RETRY_TEMPLATES]);
		const notListed = Object.values(EmailTemplateEnum).filter((template) => !listed.has(template));
		expect(notListed.length).toBe(Object.values(EmailTemplateEnum).length - EMAIL_RETRY_TEMPLATES.size);
		for (const template of notListed) {
			expect(isEmailRetryTemplate(template)).toBe(false);
		}
	});
});

describe('isEmailRetryEnabled (EMAIL_RETRY_ENABLED)', () => {
	it.each([[undefined], [''], ['true'], ['TRUE'], [' true ']])('is on for %j', (value) => {
		const warn = jest.fn();
		expect(isEmailRetryEnabled({ EMAIL_RETRY_ENABLED: value }, warn)).toBe(true);
		expect(warn).not.toHaveBeenCalled();
	});

	it('is off for false, silently', () => {
		const warn = jest.fn();
		expect(isEmailRetryEnabled({ EMAIL_RETRY_ENABLED: 'false' }, warn)).toBe(false);
		expect(isEmailRetryEnabled({ EMAIL_RETRY_ENABLED: 'False' }, warn)).toBe(false);
		expect(warn).not.toHaveBeenCalled();
	});

	it.each([['0'], ['off'], ['disabled'], ['flase']])('is off for %j, and says so without the value', (value) => {
		const warn = jest.fn();
		expect(isEmailRetryEnabled({ EMAIL_RETRY_ENABLED: value }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).not.toContain(value);
	});

	it('reads the process environment by default', () => {
		const previous = process.env.EMAIL_RETRY_ENABLED;
		try {
			delete process.env.EMAIL_RETRY_ENABLED;
			expect(isEmailRetryEnabled()).toBe(true);
			process.env.EMAIL_RETRY_ENABLED = 'false';
			expect(isEmailRetryEnabled()).toBe(false);
		} finally {
			if (previous === undefined) delete process.env.EMAIL_RETRY_ENABLED;
			else process.env.EMAIL_RETRY_ENABLED = previous;
		}
	});
});

describe('emailRetryDueAt', () => {
	const failedAt = new Date('2026-12-01T10:00:00.000Z');

	it('makes three attempts in all: the original and two retries, 5 then 30 minutes apart', () => {
		expect(EMAIL_RETRY_MAX_ATTEMPTS).toBe(3);
		expect(EMAIL_RETRY_BACKOFF_MS).toEqual([5 * 60_000, 30 * 60_000]);
		expect(emailRetryDueAt(0, failedAt)).toEqual(new Date('2026-12-01T10:05:00.000Z'));
		expect(emailRetryDueAt(1, failedAt)).toEqual(new Date('2026-12-01T10:30:00.000Z'));
		expect(emailRetryDueAt(2, failedAt)).toBeNull();
		expect(emailRetryDueAt(3, failedAt)).toBeNull();
	});

	it('answers no retry for a count it cannot read', () => {
		for (const count of [-1, 0.5, Number.NaN, undefined as unknown as number, null as unknown as number]) {
			expect(emailRetryDueAt(count, failedAt)).toBeNull();
		}
	});
});

describe('smtpTransportOf', () => {
	it("finds nodemailer's SMTP mailer of an Email instance, and nothing else", () => {
		const mailer = { transporter: { name: 'SMTP' }, sendMail: jest.fn() };
		expect(smtpTransportOf({ config: { transport: mailer } })).toBe(mailer);

		expect(
			smtpTransportOf({ config: { transport: { transporter: { name: 'SMTP (pool)' }, sendMail: jest.fn() } } })
		).toBeNull();
		expect(
			smtpTransportOf({ config: { transport: { transporter: { name: 'Resend' }, sendMail: jest.fn() } } })
		).toBeNull();
		expect(smtpTransportOf({ config: { transport: { transporter: { name: 'SMTP' } } } })).toBeNull();
		expect(smtpTransportOf({ send: jest.fn() })).toBeNull();
		expect(smtpTransportOf(undefined)).toBeNull();
		expect(smtpTransportOf(null)).toBeNull();
	});
});

describe('isReproducibleEmailMessage', () => {
	const FROM = 'noreply@gauzy.test';
	/** A message as email-templates hands one of the four retried templates to the transport. */
	const handedOver = (fields: Record<string, unknown> = {}) => ({
		from: FROM,
		to: 'ada@example.test',
		attachments: [],
		subject: 'Welcome',
		html: '<p>Welcome</p>',
		text: 'Welcome',
		...fields
	});

	it('takes the message a retry sends again as it was', () => {
		expect(isReproducibleEmailMessage(handedOver(), FROM)).toBe(true);
		expect(isReproducibleEmailMessage(handedOver({ attachments: undefined, text: undefined }), FROM)).toBe(true);
	});

	it.each([
		['headers', { headers: { 'X-PM-TrackLinks': 'None' } }],
		['a cc', { cc: 'boss@example.test' }],
		['a bcc', { bcc: ['audit@example.test'] }],
		['a reply-to', { replyTo: 'support@example.test' }],
		['threading', { inReplyTo: '<m@gauzy.test>' }],
		['a list header', { list: { unsubscribe: 'https://app.gauzy.test/u' } }],
		['a priority', { priority: 'high' }],
		['an attachment', { attachments: [{ filename: 'a.pdf' }] }],
		['attachments that are not a list', { attachments: 'a.pdf' }],
		['a sender of its own', { from: 'someone@example.test' }],
		['several recipients in one string', { to: 'ada@example.test, bob@example.test' }],
		['a list of recipients', { to: ['ada@example.test'] }],
		['no recipient', { to: '' }],
		['no subject', { subject: undefined }],
		['no HTML', { html: '  ' }],
		['an HTML part that is not text', { html: Buffer.from('<p>x</p>') }]
	])('refuses a message with %s', (_case, fields) => {
		expect(isReproducibleEmailMessage(handedOver(fields), FROM)).toBe(false);
	});

	it('refuses what is not a message', () => {
		expect(isReproducibleEmailMessage(undefined, FROM)).toBe(false);
		expect(isReproducibleEmailMessage('message' as never, FROM)).toBe(false);
	});
});

describe('emailRetryInFlightUntil', () => {
	const NOW = new Date('2026-11-27T12:00:00.000Z');
	const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

	it('holds a resend for 15 minutes after a sweep claimed the email', () => {
		expect(EMAIL_RETRY_IN_FLIGHT_MS).toBe(15 * 60_000);
		const row = { status: EmailStatusEnum.FAILED, nextRetryAt: null, lastRetryAt: minutesAgo(2) };

		expect(emailRetryInFlightUntil(row, NOW)).toEqual(new Date(minutesAgo(2).getTime() + EMAIL_RETRY_IN_FLIGHT_MS));
	});

	it('reads the claim moment as the store returns it, a string included', () => {
		const row = { status: EmailStatusEnum.FAILED, nextRetryAt: null, lastRetryAt: minutesAgo(1).toISOString() };

		expect(emailRetryInFlightUntil(row, NOW)).toEqual(new Date(minutesAgo(1).getTime() + EMAIL_RETRY_IN_FLIGHT_MS));
	});

	it('reads text without a zone, as SQLite keeps a moment, as UTC', () => {
		const row = { status: EmailStatusEnum.FAILED, nextRetryAt: null, lastRetryAt: '2026-11-27 11:58:00.000' };

		expect(emailRetryInFlightUntil(row, NOW)).toEqual(new Date('2026-11-27T12:13:00.000Z'));
	});

	it('holds nothing once the window is over', () => {
		expect(
			emailRetryInFlightUntil(
				{ status: EmailStatusEnum.FAILED, nextRetryAt: null, lastRetryAt: minutesAgo(15) },
				NOW
			)
		).toBeNull();
	});

	it('holds nothing for a row no sweep is sending: sent, due again, never claimed, or a claim time that cannot be read', () => {
		const claimed = minutesAgo(1);
		expect(
			emailRetryInFlightUntil({ status: EmailStatusEnum.SENT, nextRetryAt: null, lastRetryAt: claimed }, NOW)
		).toBeNull();
		expect(
			emailRetryInFlightUntil({ status: EmailStatusEnum.FAILED, nextRetryAt: NOW, lastRetryAt: claimed }, NOW)
		).toBeNull();
		expect(
			emailRetryInFlightUntil({ status: EmailStatusEnum.FAILED, nextRetryAt: null, lastRetryAt: null }, NOW)
		).toBeNull();
		expect(
			emailRetryInFlightUntil(
				{ status: EmailStatusEnum.FAILED, nextRetryAt: null, lastRetryAt: 'not a date' },
				NOW
			)
		).toBeNull();
	});
});
