// cspell:ignore softfail dmarc
import {
	allowlistedHeaders,
	derivedMessageId,
	deserializeParsedMessage,
	messageIdOf,
	parseMimeMessage,
	referencesOf,
	safeFilename,
	serializeParsedMessage,
	verdictsFromAuthenticationResults
} from './mime';
import { SAMPLE_MIME } from '../testing/sample-mime';

describe('MIME parsing', () => {
	it('parses addresses, threading headers, bodies and parts, keeping cid links and only allowlisted headers', async () => {
		const message = await parseMimeMessage(Buffer.from(SAMPLE_MIME), {
			envelopeRecipients: ['support.ever@inbox.example.test']
		});
		expect(message.messageId).toBe('<m-2@acme.test>');
		expect(message.inReplyTo).toBe('<m-1@acme.test>');
		expect(message.references).toEqual(['<m-0@acme.test>', '<m-1@acme.test>']);
		expect(message.from).toEqual({ address: 'ada@acme.test', name: 'Ada Lovelace' });
		expect(message.to).toEqual([{ address: 'support.ever@inbox.example.test' }]);
		expect(message.cc).toEqual([{ address: 'bob@acme.test', name: 'Bob' }]);
		expect(message.subject).toBe('Re: Invoice 42');
		expect(message.text?.trim()).toBe('Paid today.');
		expect(message.html).toContain('cid:logo@acme');
		expect(message.envelopeRecipients).toEqual(['support.ever@inbox.example.test']);
		expect(message.headers['x-secret-internal']).toBeUndefined();
		expect(message.headers['authentication-results']).toContain('spf=pass');
		const inline = message.attachments.find((part) => part.contentId === 'logo@acme');
		expect(inline?.isInline).toBe(true);
		const pdf = message.attachments.find((part) => part.contentType === 'application/pdf');
		expect(pdf?.filename).toBe('receipt.pdf');
		expect(pdf?.content.toString()).toBe('%PDF-1.4 fake');
		expect(message.raw?.length).toBe(Buffer.byteLength(SAMPLE_MIME));
	});

	it('derives a stable message id when the message has none', async () => {
		const raw = Buffer.from('From: a@b.test\r\nTo: c@d.test\r\nSubject: hi\r\n\r\nbody\r\n');
		const one = await parseMimeMessage(raw);
		const two = await parseMimeMessage(raw);
		expect(one.messageId).toBe(two.messageId);
		expect(one.messageId).toBe(derivedMessageId(raw));
	});

	it('reads the verdicts of an Authentication-Results header', () => {
		expect(
			verdictsFromAuthenticationResults(
				'mx; spf=softfail smtp.mailfrom=x; dkim=fail header.d=x; dmarc=fail (p=reject)'
			)
		).toEqual({ spf: 'softfail', dkim: 'fail', dmarc: 'fail' });
		expect(verdictsFromAuthenticationResults(undefined)).toEqual({});
	});

	it('normalizes message ids, references, names and headers', () => {
		expect(messageIdOf('abc@x')).toBe('<abc@x>');
		expect(messageIdOf('  ')).toBeUndefined();
		expect(referencesOf('<a@x> <b@x>')).toEqual(['<a@x>', '<b@x>']);
		expect(safeFilename('..\\evil/"name".exe')).toBe('_name_.exe');
		expect(safeFilename('')).toBe('attachment');
		expect(
			allowlistedHeaders([
				{ key: 'subject', line: 'Subject: first' },
				{ key: 'subject', line: 'Subject: second' },
				{ key: 'x-other', line: 'X-Other: y' }
			])
		).toEqual({ subject: 'first' });
	});

	it('round-trips the JSON raw form of a message without MIME', async () => {
		const parsed = await parseMimeMessage(Buffer.from(SAMPLE_MIME));
		const copy = deserializeParsedMessage(serializeParsedMessage(parsed));
		expect(copy.messageId).toBe(parsed.messageId);
		expect(copy.receivedAt).toBeInstanceOf(Date);
		expect(copy.attachments.map((part) => part.content.toString())).toEqual(
			parsed.attachments.map((part) => part.content.toString())
		);
		expect(copy.raw).toBeUndefined();
		expect(() => deserializeParsedMessage(Buffer.from('{"format":"other"}'))).toThrow();
	});
});
