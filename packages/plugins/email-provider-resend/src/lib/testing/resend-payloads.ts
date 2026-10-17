/**
 * Resend payloads, in the shapes of Resend's documented webhook and Receiving API (ids, addresses and URLs are
 * fixtures). Used by the specs to check the parsing, never at runtime.
 */
export const RECEIVED_EMAIL_ID = '4ef9a417-02e9-4d39-ad75-9611e0fcc33c';
export const ATTACHMENT_ID = '2a0c9ce0-3112-4728-976e-47ddcd16a318';
export const ATTACHMENT_URL = `https://inbound-cdn.resend.example/attachments/${ATTACHMENT_ID}?signature=fixture`;

/** The `email.received` webhook (metadata only). */
export const EMAIL_RECEIVED_EVENT = {
	type: 'email.received',
	created_at: '2026-10-16T10:00:01.000Z',
	data: {
		email_id: RECEIVED_EMAIL_ID,
		created_at: '2026-10-16T10:00:00.000Z',
		from: 'Ada Lovelace <ada@acme.test>',
		to: ['support.ever@inbox.example.test'],
		cc: [],
		bcc: [],
		message_id: '<m-2@acme.test>',
		subject: 'Re: Invoice 42',
		attachments: [
			{
				id: ATTACHMENT_ID,
				filename: 'receipt.pdf',
				content_type: 'application/pdf',
				content_disposition: 'attachment',
				content_id: null
			}
		]
	}
};

/** `GET /emails/receiving/:id`. */
export const RECEIVED_EMAIL = {
	object: 'email',
	id: RECEIVED_EMAIL_ID,
	to: ['support.ever@inbox.example.test'],
	from: 'Ada Lovelace <ada@acme.test>',
	created_at: '2026-10-16T10:00:00.000Z',
	subject: 'Re: Invoice 42',
	html: '<p onclick="x()">Paid <b>today</b>.</p>',
	text: 'Paid today.',
	headers: {
		'In-Reply-To': '<m-1@acme.test>',
		References: '<m-0@acme.test> <m-1@acme.test>',
		'X-Mailer': 'Fixture Mail 1.0'
	},
	bcc: [],
	cc: ['Bob <bob@acme.test>'],
	reply_to: [],
	message_id: '<m-2@acme.test>',
	attachments: [
		{
			id: ATTACHMENT_ID,
			filename: 'receipt.pdf',
			content_type: 'application/pdf',
			content_disposition: 'attachment',
			size: 13
		}
	]
};

/** `GET /emails/receiving/:id/attachments`. */
export const RECEIVED_ATTACHMENTS = {
	object: 'list',
	data: [
		{
			id: ATTACHMENT_ID,
			filename: '../receipt.pdf',
			content_type: 'application/pdf',
			content_disposition: 'attachment',
			size: 13,
			download_url: ATTACHMENT_URL,
			expires_at: '2026-10-16T11:00:00.000Z'
		}
	]
};

/** `GET /domains`. */
export const DOMAINS = {
	data: [
		{ id: 'd1', name: 'acme.test', status: 'verified' },
		{ id: 'd2', name: 'new.acme.test', status: 'pending' }
	]
};
