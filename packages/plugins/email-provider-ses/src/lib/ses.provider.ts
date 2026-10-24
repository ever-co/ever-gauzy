// cspell:ignore dmarc temperror sesv amazonses
import {
	Inject,
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
	Optional,
	UnauthorizedException
} from '@nestjs/common';
import { KeyObject } from 'node:crypto';
import { INBOX_EMAIL_PROVIDER_REGISTRY } from '@gauzy/contracts';
import {
	getInboxEmailConfig,
	HOLD_VIRUS,
	IEmailProviderPlugin,
	IEmailProviderRegistry,
	IInboundDeliveryIdentity,
	IInboundEmailProvider,
	IInboundWebhookRequest,
	IProviderAccountContext,
	parseMimeMessage,
	ParsedInboundEmail
} from '@gauzy/plugin-inbox';
import { AwsCredentials, signAwsRequest } from './sigv4';
import { isSnsUrl, signingKeyOf, SNS_TYPES, SnsMessage, verifySnsSignature } from './sns';

/** The token a spec replaces `fetch` with. */
export const SES_FETCH = 'SES_FETCH';
/**
 * How old an SNS message may be: SNS retries keep the original timestamp, and a delivery policy can retry for many
 * hours, so a day (a stored delivery's id is single use for longer than that).
 */
export const SES_SNS_TOLERANCE_SECONDS = 24 * 60 * 60;
/** A FAIL spam verdict counts as this spam score (at or above the default quarantine threshold). */
export const SES_FAILED_VERDICT_SCORE = 100;
const TIMEOUT_MS = 15_000;
const MAX_CACHED_CERTIFICATES = 20;
const REGION = /^[a-z]{2}(-[a-z]+)+-\d+$/;
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

export type SesFetch = (url: string, init: RequestInit) => Promise<Response>;

/** An Amazon SES / S3 / SNS API error (status + a short code; never a key). */
export class SesApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string
	) {
		super(message);
		this.name = 'SesApiError';
	}
}

/** SES's "Received" notification (the parts the plugin reads). */
interface SesReceivedNotification {
	notificationType?: string;
	mail?: { source?: string; messageId?: string; timestamp?: string };
	receipt?: {
		timestamp?: string;
		recipients?: unknown[];
		spfVerdict?: { status?: string };
		dkimVerdict?: { status?: string };
		dmarcVerdict?: { status?: string };
		spamVerdict?: { status?: string };
		virusVerdict?: { status?: string };
		action?: { type?: string; encoding?: string; bucketName?: string; objectKey?: string; topicArn?: string };
	};
	content?: string;
}

/** The parts of nodemailer's mail object the raw-message transport reads. */
interface RawMailObject {
	message: {
		messageId(): string;
		getEnvelope(): { from?: string | false; to?: string[] };
		createReadStream(): NodeJS.ReadableStream;
	};
}

/** SES's verdict words as the Inbox's (`GRAY`: not determinable). */
function verdictOf(status: string | undefined) {
	switch ((status ?? '').toUpperCase()) {
		case 'PASS':
			return 'pass' as const;
		case 'FAIL':
			return 'fail' as const;
		case 'GRAY':
			return 'none' as const;
		case 'PROCESSING_FAILED':
			return 'temperror' as const;
		default:
			return undefined;
	}
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * The `Message-ID` header SES gives a message it sends (it replaces the one in the raw message): its message id at
 * `email.amazonses.com` in us-east-1, at `<region>.amazonses.com` elsewhere. A reply names this one (review F64).
 */
export function sesMessageIdHeader(messageId: string, region: string): string {
	return `<${messageId}@${region === 'us-east-1' ? 'email' : region}.amazonses.com>`;
}

/** Reads a response body up to `cap` bytes (more is an error), never buffering beyond it. */
async function readCapped(response: Response, cap: number): Promise<Buffer> {
	const declared = Number(response.headers.get('content-length') ?? '');
	if (Number.isFinite(declared) && declared > cap)
		throw new SesApiError(413, 'too_large', 'The stored message is too large.');
	if (!response.body) return Buffer.from(await response.arrayBuffer());
	const reader = response.body.getReader();
	const chunks: Buffer[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.length;
		if (size > cap) {
			await reader.cancel().catch(() => undefined);
			throw new SesApiError(413, 'too_large', 'The stored message is too large.');
		}
		chunks.push(Buffer.from(value));
	}
	return Buffer.concat(chunks);
}

/**
 * Amazon SES (plan 04 §5.2, G-P4-7).
 *
 * - **Inbound.** An SES receipt rule publishes each message to an SNS topic, either inside the notification (an SNS
 *   action) or in S3 (an S3 action that notifies the topic). The topic's HTTPS subscription is the account URL
 *   (`/api/inbox/inbound/ses/<account id>`). Every SNS POST is verified:
 *     - the topic must be the account's;
 *     - the signature (SignatureVersion 1 or 2) must verify under the signing certificate, fetched only from
 *       `https://sns.<region>.amazonaws.com/….pem` and cached;
 *     - the timestamp must be within a day (SNS retries keep it).
 *
 *   There is no unsigned mode. The SNS message id makes a delivery single use. A subscription confirmation is
 *   confirmed (its `SubscribeURL`, on SNS only) once it verifies. The message is fetched from the account's bucket
 *   (SigV4) when it was stored in S3.
 * - **Verdicts.** SES's own SPF, DKIM and **DMARC** checks are trusted, so a sender allowlist works with SES. A FAIL
 *   spam verdict scores the message as spam; a FAIL virus verdict holds it in the quarantine whatever the threshold.
 * - **Outbound.** A nodemailer transport sending the raw message through SESv2 `SendEmail`
 *   (`POST /v2/email/outbound-emails`, SigV4).
 * - **Test connection.** SESv2 `GetAccount`.
 */
@Injectable()
export class SesProvider implements IEmailProviderPlugin, IInboundEmailProvider, OnModuleInit, OnModuleDestroy {
	readonly id = 'ses';
	readonly displayName = 'Amazon SES';
	readonly description = 'Receive with an SES receipt rule (SNS, or S3 + SNS) and send through the SESv2 API.';
	readonly capabilities = { inbound: true, outbound: true, customDomains: true };
	readonly configSchema = {
		type: 'object' as const,
		properties: {
			topicArn: {
				type: 'string' as const,
				title: 'SNS topic ARN',
				description: 'The topic the receipt rule publishes to; its HTTPS subscription is this account’s URL.',
				pattern: '^arn:aws(-[a-z]+)*:sns:[a-z0-9-]+:\\d{12}:[A-Za-z0-9_-]{1,256}$'
			},
			region: {
				type: 'string' as const,
				title: 'AWS region',
				description: 'The SES region (receiving, the bucket, sending), for example eu-west-1.',
				pattern: '^[a-z]{2}(-[a-z]+)+-\\d+$'
			},
			accessKeyId: {
				type: 'string' as const,
				title: 'Access key ID',
				description: 'An IAM access key allowed to send (ses:SendEmail) and to read the bucket.',
				writeOnly: true
			},
			secretAccessKey: {
				type: 'string' as const,
				title: 'Secret access key',
				writeOnly: true
			},
			s3Bucket: {
				type: 'string' as const,
				title: 'S3 bucket',
				description: 'Where an S3 receipt action stores the messages (only this bucket is read).',
				maxLength: 63
			},
			fromAddress: {
				type: 'string' as const,
				title: 'Default sender',
				description: 'An address on a verified SES identity.',
				format: 'email' as const
			}
		},
		required: ['topicArn', 'region']
	};
	readonly inbound: IInboundEmailProvider = this;
	private readonly logger = new Logger(SesProvider.name);
	/** One parse of a body per request. */
	private readonly bodies = new WeakMap<object, SnsMessage | null>();
	/** The signing certificates' keys, by URL. */
	private readonly certificates = new Map<string, Promise<KeyObject | null>>();

	constructor(
		@Optional() @Inject(INBOX_EMAIL_PROVIDER_REGISTRY) private readonly registry?: IEmailProviderRegistry,
		@Optional() @Inject(SES_FETCH) private readonly fetcher?: SesFetch
	) {}

	onModuleInit(): void {
		if (!this.registry) {
			this.logger.warn(
				'The Inbox email features are off (GAUZY_INBOX_EMAIL_ENABLED): the Amazon SES provider stays idle.'
			);
			return;
		}
		this.registry.register(this);
	}

	onModuleDestroy(): void {
		this.registry?.unregister(this.id);
	}

	async verify(request: IInboundWebhookRequest, account: IProviderAccountContext): Promise<IInboundDeliveryIdentity> {
		const message = this.snsOf(request);
		const topic = asText(account.config['topicArn']);
		if (!message || !topic || !SNS_TYPES.includes(message.Type as (typeof SNS_TYPES)[number])) {
			throw new UnauthorizedException('The SES delivery is not a signed SNS message for this account.');
		}
		if (message.TopicArn !== topic) {
			throw new UnauthorizedException('The SNS message is not from this account’s topic.');
		}
		const at = Date.parse(asText(message.Timestamp));
		if (!Number.isFinite(at) || Math.abs(Date.now() - at) > SES_SNS_TOLERANCE_SECONDS * 1000) {
			throw new UnauthorizedException('The SNS message is more than a day old (or from the future).');
		}
		const key = isSnsUrl(message.SigningCertURL, true) ? await this.certificate(message.SigningCertURL) : null;
		if (!key || !verifySnsSignature(message, key)) {
			throw new UnauthorizedException('The SNS signature does not verify.');
		}
		return { fingerprint: `sns:${message.MessageId}`, ttlMs: (2 * SES_SNS_TOLERANCE_SECONDS + 60) * 1000 };
	}

	async parse(request: IInboundWebhookRequest, account?: IProviderAccountContext): Promise<ParsedInboundEmail[]> {
		const message = this.snsOf(request);
		if (!message) return [];
		if (message.Type === 'SubscriptionConfirmation') {
			await this.confirm(message);
			return [];
		}
		if (message.Type !== 'Notification') return [];
		let notification: SesReceivedNotification;
		try {
			notification = JSON.parse(asText(message.Message)) as SesReceivedNotification;
		} catch {
			return [];
		}
		if (notification?.notificationType !== 'Received') return [];
		const receipt = notification.receipt ?? {};
		const raw = await this.rawOf(notification, account);
		if (!raw) return [];

		const failed = (status: string | undefined) => (status ?? '').toUpperCase() === 'FAIL';
		const spf = verdictOf(receipt.spfVerdict?.status);
		const dkim = verdictOf(receipt.dkimVerdict?.status);
		const dmarc = verdictOf(receipt.dmarcVerdict?.status);
		const receivedAt = new Date(asText(receipt.timestamp) || asText(notification.mail?.timestamp) || Date.now());
		const envelopeFrom = asText(notification.mail?.source).trim();
		const providerMessageId = asText(notification.mail?.messageId);
		return [
			await parseMimeMessage(raw, {
				envelopeRecipients: (Array.isArray(receipt.recipients) ? receipt.recipients : []).filter(
					(entry): entry is string => typeof entry === 'string' && entry.includes('@')
				),
				...(envelopeFrom ? { envelopeFrom } : {}),
				receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
				...(spf ? { spf } : {}),
				...(dkim ? { dkim } : {}),
				...(dmarc ? { dmarc } : {}),
				...(failed(receipt.spamVerdict?.status) ? { spamScore: SES_FAILED_VERDICT_SCORE } : {}),
				// A failed virus scan is held whatever the spam threshold.
				...(failed(receipt.virusVerdict?.status) ? { hold: HOLD_VIRUS } : {}),
				...(providerMessageId ? { providerMessageId } : {})
			})
		];
	}

	createTransport(account: IProviderAccountContext): unknown {
		// An account set up for receiving only (no keys, or no region) has no transport: the error tells the resolver
		// to try the next account, then SMTP, instead of handing over a transport that fails every send (review F62).
		const region = this.region(account);
		this.credentials(account);
		const fallbackFrom = asText(account.config['fromAddress']) || undefined;
		return {
			name: 'ses',
			version: '1.0.0',
			send: (mail: RawMailObject, callback: (error: Error | null, info?: Record<string, unknown>) => void) => {
				const envelope = mail.message.getEnvelope();
				const to = (envelope.to ?? []).filter(Boolean);
				this.readStream(mail.message.createReadStream())
					.then(async (raw) => {
						if (to.length === 0) throw new SesApiError(0, 'no_recipient', 'An email needs a recipient.');
						const from = envelope.from || fallbackFrom;
						const response = await this.call(account, 'POST', '/v2/email/outbound-emails', {
							Content: { Raw: { Data: raw.toString('base64') } },
							...(from ? { FromEmailAddress: from } : {}),
							Destination: { ToAddresses: to }
						});
						const answer = (await response.json().catch(() => null)) as { MessageId?: string } | null;
						if (!answer?.MessageId) {
							throw new SesApiError(502, 'invalid_response', 'SES accepted the email without an id.');
						}
						callback(null, {
							// The id SES sent the message under, not the one it replaced: replies thread on it.
							messageId: sesMessageIdHeader(answer.MessageId, region),
							envelope,
							accepted: to,
							rejected: [],
							response: `ses:${answer.MessageId}`,
							providerMessageId: answer.MessageId
						});
					})
					.catch((error: Error) => callback(error));
			}
		};
	}

	async verifyAccount(account: IProviderAccountContext): Promise<{ ok: boolean; message?: string }> {
		try {
			const response = await this.call(account, 'GET', '/v2/email/account');
			const answer = (await response.json().catch(() => null)) as {
				SendingEnabled?: boolean;
				ProductionAccessEnabled?: boolean;
			} | null;
			if (!answer?.SendingEnabled) return { ok: false, message: 'Sending is paused for this SES account.' };
			return {
				ok: true,
				message: answer.ProductionAccessEnabled
					? 'Connected: the SES account can send.'
					: 'Connected: the SES account is in the sandbox (it sends only to verified addresses).'
			};
		} catch (error) {
			if (error instanceof SesApiError && (error.status === 401 || error.status === 403))
				return { ok: false, message: 'AWS refused the access key.' };
			return {
				ok: false,
				message: error instanceof Error ? error.message.slice(0, 300) : 'The connection test failed.'
			};
		}
	}

	// ---------------------------------------------------------------- helpers

	/** The SNS message of a request: SNS posts JSON as `text/plain`, which the webhook route keeps raw. */
	private snsOf(request: IInboundWebhookRequest): SnsMessage | null {
		if (this.bodies.has(request)) return this.bodies.get(request) ?? null;
		let message: SnsMessage | null = null;
		const body = request.body;
		if (body && typeof body === 'object' && !Array.isArray(body) && 'Type' in body) {
			message = body as SnsMessage;
		} else if (request.rawBody?.length) {
			try {
				const parsed = JSON.parse(request.rawBody.toString('utf8')) as unknown;
				message =
					parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as SnsMessage) : null;
			} catch {
				message = null;
			}
		}
		this.bodies.set(request, message);
		return message;
	}

	/** The signing certificate's key (fetched once per URL; a failed fetch is not remembered). */
	private certificate(url: string): Promise<KeyObject | null> {
		let key = this.certificates.get(url);
		if (!key) {
			key = this.fetch(url, { method: 'GET' })
				.then(async (response) => (response.ok ? signingKeyOf(await response.text()) : null))
				.catch(() => null);
			if (this.certificates.size >= MAX_CACHED_CERTIFICATES) {
				this.certificates.delete(this.certificates.keys().next().value as string);
			}
			this.certificates.set(url, key);
			void key.then((value) => {
				if (!value) this.certificates.delete(url);
			});
		}
		return key;
	}

	/** Confirms a verified subscription (a GET of its `SubscribeURL`, on SNS only). */
	private async confirm(message: SnsMessage): Promise<void> {
		if (!isSnsUrl(message.SubscribeURL)) {
			throw new SesApiError(400, 'bad_subscribe_url', 'The subscription confirmation names no SNS URL.');
		}
		const response = await this.fetch(message.SubscribeURL, { method: 'GET' });
		if (!response.ok) {
			throw new SesApiError(
				response.status,
				'subscribe_failed',
				`SNS answered ${response.status} to the confirmation.`
			);
		}
		this.logger.log(`Confirmed the SNS subscription of topic ${String(message.TopicArn).slice(0, 300)}.`);
	}

	/** The raw message: inside the notification (an SNS action), or in the account's bucket (an S3 action). */
	private async rawOf(
		notification: SesReceivedNotification,
		account?: IProviderAccountContext
	): Promise<Buffer | null> {
		const action = notification.receipt?.action ?? {};
		if (typeof notification.content === 'string' && notification.content) {
			return (action.encoding ?? '').toUpperCase() === 'BASE64'
				? Buffer.from(notification.content, 'base64')
				: Buffer.from(notification.content, 'utf8');
		}
		if ((action.type ?? '').toUpperCase() !== 'S3') return null;
		const bucket = asText(account?.config['s3Bucket']).trim();
		const key = asText(action.objectKey);
		if (!account || !bucket || action.bucketName !== bucket || !BUCKET.test(bucket) || !key) {
			throw new SesApiError(
				422,
				'bucket_mismatch',
				'The message is stored in S3, but not in the bucket this account reads (set the account’s S3 bucket).'
			);
		}
		const region = this.region(account);
		const segments = key.split('/');
		// A `.` or `..` segment would be resolved by the URL (and signed so): with a path-style bucket it could read
		// another bucket with the account's keys. SES never writes one (review F61).
		if (segments.some((segment) => segment === '.' || segment === '..')) {
			throw new SesApiError(422, 'bad_object_key', 'The stored message’s S3 key is not one SES writes.');
		}
		const path = segments.map((segment) => encodeURIComponent(segment)).join('/');
		// Virtual-hosted style, or path style for a bucket name with dots (its certificate would not match).
		const expected = bucket.includes('.') ? `/${bucket}/${path}` : `/${path}`;
		const url = bucket.includes('.')
			? `https://s3.${region}.amazonaws.com${expected}`
			: `https://${bucket}.s3.${region}.amazonaws.com${expected}`;
		// Only this bucket's object is ever fetched: the URL's path is the one built, nothing resolved away.
		if (new URL(url).pathname !== expected) {
			throw new SesApiError(422, 'bad_object_key', 'The stored message’s S3 key is not one SES writes.');
		}
		const response = await this.fetch(url, {
			method: 'GET',
			headers: signAwsRequest({ method: 'GET', url }, this.credentials(account), region, 's3')
		});
		if (!response.ok) {
			throw new SesApiError(
				response.status,
				's3_failed',
				`S3 answered ${response.status} for the stored message.`
			);
		}
		return readCapped(response, getInboxEmailConfig().maxMessageBytes);
	}

	private region(account: IProviderAccountContext): string {
		const region = asText(account.config['region']).trim();
		if (!REGION.test(region)) throw new SesApiError(0, 'missing_region', 'The SES account has no AWS region.');
		return region;
	}

	private credentials(account: IProviderAccountContext): AwsCredentials {
		const accessKeyId = asText(account.config['accessKeyId']).trim();
		const secretAccessKey = asText(account.config['secretAccessKey']).trim();
		if (!accessKeyId || !secretAccessKey) {
			throw new SesApiError(0, 'missing_keys', 'The SES account has no AWS access key.');
		}
		return { accessKeyId, secretAccessKey };
	}

	/** A SigV4-signed SESv2 call; a non-2xx answer is a {@link SesApiError}. */
	private async call(
		account: IProviderAccountContext,
		method: 'GET' | 'POST',
		path: string,
		body?: unknown
	): Promise<Response> {
		const region = this.region(account);
		const url = `https://email.${region}.amazonaws.com${path}`;
		const payload = body === undefined ? undefined : JSON.stringify(body);
		const headers = signAwsRequest(
			{
				method,
				url,
				headers: { accept: 'application/json', ...(payload ? { 'content-type': 'application/json' } : {}) },
				...(payload ? { body: payload } : {})
			},
			this.credentials(account),
			region,
			// SESv2's signing name.
			'ses'
		);
		// `host` is set by fetch itself.
		delete headers['host'];
		const response = await this.fetch(url, { method, headers, ...(payload ? { body: payload } : {}) });
		if (!response.ok) {
			const text = await response.text().catch(() => '');
			let message = `SES answered ${response.status}.`;
			try {
				const parsed = JSON.parse(text) as { message?: unknown; Message?: unknown };
				const said = parsed.message ?? parsed.Message;
				if (typeof said === 'string') message = said.slice(0, 300);
			} catch {
				// Not JSON: the status says enough.
			}
			throw new SesApiError(response.status, `http_${response.status}`, message);
		}
		return response;
	}

	private fetch(url: string, init: RequestInit): Promise<Response> {
		const fetcher = this.fetcher ?? ((target: string, options: RequestInit) => fetch(target, options));
		return fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS), ...init });
	}

	private readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			stream.on('data', (chunk: Buffer | string) =>
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
			);
			stream.once('error', reject);
			stream.once('end', () => resolve(Buffer.concat(chunks)));
		});
	}
}
