import { createPublicKey, createVerify, KeyObject } from 'node:crypto';

/** An Amazon SNS message posted to an HTTP(S) subscription (the fields the plugin reads). */
export interface SnsMessage {
	Type?: string;
	MessageId?: string;
	Token?: string;
	TopicArn?: string;
	Subject?: string;
	Message?: string;
	Timestamp?: string;
	SignatureVersion?: string;
	Signature?: string;
	SigningCertURL?: string;
	SubscribeURL?: string;
}

/** The message types an HTTP(S) subscription receives. */
export const SNS_TYPES = ['Notification', 'SubscriptionConfirmation', 'UnsubscribeConfirmation'] as const;

/** An SNS endpoint URL (`SigningCertURL`, `SubscribeURL`): https on `sns.<region>.amazonaws.com` (or `.com.cn`). */
export function isSnsUrl(value: unknown, pem = false): value is string {
	if (typeof value !== 'string') return false;
	try {
		const url = new URL(value);
		return (
			url.protocol === 'https:' &&
			!url.username &&
			!url.password &&
			(url.port === '' || url.port === '443') &&
			/^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(url.hostname) &&
			(!pem || url.pathname.endsWith('.pem'))
		);
	} catch {
		return false;
	}
}

/**
 * The string SNS signs (https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html): the listed
 * fields as `Name\nvalue\n`, in this order, `Subject` only when present.
 */
export function snsStringToSign(message: SnsMessage): string | null {
	const fields =
		message.Type === 'Notification'
			? (['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'] as const)
			: (['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'] as const);
	let text = '';
	for (const field of fields) {
		const value = message[field];
		if (value === undefined || value === null) {
			if (field === 'Subject') continue;
			return null;
		}
		text += `${field}\n${value}\n`;
	}
	return text;
}

/** Whether the SNS signature verifies under the certificate's key (SignatureVersion 1: SHA1, 2: SHA256). */
export function verifySnsSignature(message: SnsMessage, key: KeyObject): boolean {
	const text = snsStringToSign(message);
	const algorithm =
		message.SignatureVersion === '2' ? 'RSA-SHA256' : message.SignatureVersion === '1' ? 'RSA-SHA1' : null;
	if (!text || !algorithm || typeof message.Signature !== 'string' || !message.Signature) return false;
	try {
		const verifier = createVerify(algorithm);
		verifier.update(text, 'utf8');
		verifier.end();
		return verifier.verify(key, Buffer.from(message.Signature, 'base64'));
	} catch {
		return false;
	}
}

/** The public key of a signing certificate (PEM), or `null`. */
export function signingKeyOf(pem: string): KeyObject | null {
	try {
		const key = createPublicKey(pem);
		return key.asymmetricKeyType === 'rsa' ? key : null;
	} catch {
		return null;
	}
}
