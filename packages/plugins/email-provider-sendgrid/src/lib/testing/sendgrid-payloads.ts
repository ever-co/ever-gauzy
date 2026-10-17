// cspell:ignore dmarc
/** An Inbound Parse POST (parsed mode), in the shape SendGrid documents (fixture values). */
export const PARSED_FIELDS: Record<string, string> = {
	headers: [
		'Received: by mx.sendgrid.net with SMTP id abc',
		'Authentication-Results: forged.example; dmarc=pass',
		'Message-ID: <m-2@acme.test>',
		'In-Reply-To: <m-1@acme.test>',
		'References: <m-0@acme.test>',
		' <m-1@acme.test>',
		'Reply-To: Ada <ada+billing@acme.test>',
		'Date: Fri, 16 Oct 2026 10:00:00 +0000',
		'Subject: Re: Invoice 42'
	].join('\n'),
	dkim: '{@acme.test : pass}',
	'content-ids': JSON.stringify({ 'logo@acme.test': 'attachment2' }),
	to: 'support.ever@inbox.example.test',
	from: '"Lovelace, Ada" <ada@acme.test>',
	cc: 'Bob <bob@acme.test>',
	text: 'Paid today.',
	html: '<p>Paid <b>today</b>. <img src="cid:logo@acme.test"></p>',
	sender_ip: '203.0.113.5',
	spam_report: 'Spam detection software has NOT identified this incoming email as spam.',
	envelope: JSON.stringify({ to: ['support.ever@inbox.example.test'], from: 'bounce@acme.test' }),
	attachments: '2',
	subject: 'Re: Invoice 42',
	spam_score: '0.4',
	'attachment-info': JSON.stringify({
		attachment1: { filename: 'receipt.pdf', name: 'receipt.pdf', type: 'application/pdf' },
		attachment2: { filename: 'logo.png', name: 'logo.png', type: 'image/png', 'content-id': 'logo@acme.test' }
	}),
	charsets: JSON.stringify({ to: 'UTF-8', subject: 'UTF-8', from: 'UTF-8', text: 'UTF-8', html: 'UTF-8' }),
	SPF: 'pass'
};

/** An Inbound Parse POST with "POST the raw, full MIME message". */
export const RAW_MIME =
	'From: a@b.test\r\nTo: support.ever@inbox.example.test\r\nMessage-ID: <raw-1@b.test>\r\nSubject: hi\r\n\r\nbody\r\n';
