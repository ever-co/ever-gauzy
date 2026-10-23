// cspell:ignore dmarc
/** The account's topic (fixture values). */
export const TOPIC_ARN = 'arn:aws:sns:eu-west-1:123456789012:gauzy-inbox';
export const CERT_URL = 'https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-fixture.pem';

export const RAW_MIME = [
	'From: "Lovelace, Ada" <ada@acme.test>',
	'To: support.ever@inbox.example.test',
	'Message-ID: <m-2@acme.test>',
	'In-Reply-To: <m-1@acme.test>',
	'Subject: Re: Invoice 42',
	'Authentication-Results: forged.example; dmarc=fail',
	'',
	'Paid today.',
	''
].join('\r\n');

/** SES's "Received" notification for an SNS receipt action (the message inside, base64), in the documented shape. */
export function receivedNotification(overrides: Record<string, unknown> = {}) {
	return {
		notificationType: 'Received',
		mail: {
			timestamp: '2026-10-16T10:00:00.000Z',
			source: 'bounce@acme.test',
			messageId: 'o3vrnil0e2ic28trm7dfhrc2v0clambda4nbp0g1',
			destination: ['support.ever@inbox.example.test'],
			headersTruncated: false,
			commonHeaders: { from: ['"Lovelace, Ada" <ada@acme.test>'], messageId: '<m-2@acme.test>' }
		},
		receipt: {
			timestamp: '2026-10-16T10:00:01.000Z',
			processingTimeMillis: 222,
			recipients: ['support.ever@inbox.example.test'],
			spamVerdict: { status: 'PASS' },
			virusVerdict: { status: 'PASS' },
			spfVerdict: { status: 'PASS' },
			dkimVerdict: { status: 'PASS' },
			dmarcVerdict: { status: 'PASS' },
			action: { type: 'SNS', topicArn: TOPIC_ARN, encoding: 'BASE64' }
		},
		content: Buffer.from(RAW_MIME).toString('base64'),
		...overrides
	};
}
