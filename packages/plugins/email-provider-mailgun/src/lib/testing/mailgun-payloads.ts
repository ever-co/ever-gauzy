// cspell:ignore Sscore Sflag dmarc
/**
 * A Mailgun route `forward()` POST, in the shape Mailgun documents for a parsed message (fixture values; the
 * signature fields are added by the spec, which signs them with its own fixture key).
 */
export const PARSED_ROUTE_FIELDS: Record<string, string> = {
	recipient: 'support.ever@inbox.example.test',
	sender: 'bounce+ada@acme.test',
	from: '"Lovelace, Ada" <ada@acme.test>',
	subject: 'Re: Invoice 42',
	'body-plain': 'Paid today.\n\n> earlier text',
	'stripped-text': 'Paid today.',
	'body-html': '<p>Paid <b>today</b>. <img src="cid:logo@acme.test"></p>',
	'attachment-count': '2',
	'content-id-map': JSON.stringify({ '<logo@acme.test>': 'attachment-2' }),
	'Message-Id': '<m-2@acme.test>',
	'In-Reply-To': '<m-1@acme.test>',
	References: '<m-0@acme.test> <m-1@acme.test>',
	To: 'support.ever@inbox.example.test',
	Cc: 'Bob <bob@acme.test>',
	Date: 'Fri, 16 Oct 2026 10:00:00 +0000',
	'message-headers': JSON.stringify([
		['X-Mailgun-Spf', 'Pass'],
		['X-Mailgun-Dkim-Check-Result', 'Pass'],
		['X-Mailgun-Sscore', '0.3'],
		['X-Mailgun-Sflag', 'No'],
		['Received', 'by mxa.mailgun.org with SMTP'],
		['Authentication-Results', 'forged.example; dmarc=pass'],
		// A sender's own copy of a Mailgun header comes after Mailgun's: it does not count.
		['X-Mailgun-Spf', 'Fail'],
		['Reply-To', 'Ada <ada+billing@acme.test>'],
		['Message-Id', '<m-2@acme.test>']
	])
};

/** A route POST to a URL ending in `mime`: the raw message. */
export const RAW_MIME =
	'From: a@b.test\r\nTo: support.ever@inbox.example.test\r\nMessage-ID: <raw-1@b.test>\r\nSubject: hi\r\n\r\nbody\r\n';
