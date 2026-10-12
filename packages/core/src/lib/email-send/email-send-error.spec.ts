// cspell:ignore EENVELOPE EAUTH
import { describeEmailSendError, redactEmailAddresses } from './email-send-error';

describe('redactEmailAddresses', () => {
	it('masks every address in free text', () => {
		expect(redactEmailAddresses('Found inactive addresses: jane.doe+gauzy@example.org, x@y.io.')).toBe(
			'Found inactive addresses: <redacted-email>, <redacted-email>.'
		);
	});

	it('masks addresses inside angle brackets and quotes', () => {
		expect(redactEmailAddresses('RCPT TO:<buyer@corp.co> rejected; "ops@corp.co"')).toBe(
			'RCPT TO:<<redacted-email>> rejected; "<redacted-email>"'
		);
	});

	it('leaves text without an address alone (control)', () => {
		expect(redactEmailAddresses('Invalid login: 535 Authentication failed')).toBe(
			'Invalid login: 535 Authentication failed'
		);
	});

	it('returns an empty string for non-strings', () => {
		expect(redactEmailAddresses(undefined as unknown as string)).toBe('');
	});
});

describe('describeEmailSendError', () => {
	it('keeps the provider code, SMTP reply code and command, and masks the recipient', () => {
		// The shape nodemailer produces for Postmark's inactive-recipient rejection.
		const error = Object.assign(
			new Error(
				"Can't send mail - all recipients were rejected: 406 Inactive recipient. Found inactive addresses: buyer@corp.co."
			),
			{ code: 'EENVELOPE', responseCode: 406, command: 'RCPT TO' }
		);

		const line = describeEmailSendError(error);

		expect(line).toContain('code=EENVELOPE');
		expect(line).toContain('responseCode=406');
		expect(line).toContain('command=RCPT TO');
		expect(line).toContain('<redacted-email>');
		expect(line).not.toContain('buyer@corp.co');
	});

	it('falls back to the SMTP response text when there is no message', () => {
		const line = describeEmailSendError({ code: 'EAUTH', response: '535 5.7.8 bad token for ops@corp.co' });
		expect(line).toBe('code=EAUTH message="535 5.7.8 bad token for <redacted-email>"');
	});

	it('names a non-generic error class', () => {
		expect(describeEmailSendError(new TypeError("Cannot read properties of undefined (reading 'send')"))).toBe(
			`name=TypeError message="Cannot read properties of undefined (reading 'send')"`
		);
	});

	it('handles thrown strings and nothing at all', () => {
		expect(describeEmailSendError('boom for a@b.co')).toBe('message="boom for <redacted-email>"');
		expect(describeEmailSendError(undefined)).toBe('unknown error');
		expect(describeEmailSendError({})).toBe('unknown error');
	});

	it('keeps a provider HTML page to one bounded line', () => {
		const line = describeEmailSendError(new Error('<html>\n' + 'x'.repeat(2000) + '\n</html>'));
		expect(line.includes('\n')).toBe(false);
		expect(line.length).toBeLessThan(530);
	});
});
