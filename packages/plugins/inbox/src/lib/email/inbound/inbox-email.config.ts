/** The Inbox email settings read from the environment (none of them is a switch: `GAUZY_INBOX_EMAIL_ENABLED` is). */
export interface InboxEmailConfig {
	/** `GAUZY_INBOX_DOMAIN`: the platform mailbox domain (an `inbox.` subdomain per environment). */
	domain: string | null;
	/** `GAUZY_INBOX_PLATFORM_SECRET`: the signing secret of the platform route (`/inbound/generic/platform`). */
	platformSecret: string | null;
	/** `GAUZY_INBOX_MAX_MESSAGE_BYTES` (default 25 MB). */
	maxMessageBytes: number;
	/** `GAUZY_INBOX_SPAM_SUSPECT_SCORE` (default 5): a provider score at or above it marks a message suspect. */
	spamSuspectScore: number;
	/** `GAUZY_INBOX_SPAM_QUARANTINE_SCORE` (default 10): at or above it the message is quarantined. */
	spamQuarantineScore: number;
	/** `GAUZY_INBOX_INBOUND_REQUESTS_PER_MINUTE` (default 600): per client address on the provider webhook. */
	inboundRequestsPerMinute: number;
	/** `GAUZY_INBOX_EMAIL_WORKER` = `off` keeps this process from processing received messages (it still accepts them). */
	workerEnabled: boolean;
}

export const DEFAULT_MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

function positive(raw: string | undefined, fallback: number): number {
	const value = Number(raw);
	return raw !== undefined && raw.trim() !== '' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** The settings of this process. */
export function getInboxEmailConfig(env: Record<string, string | undefined> = process.env): InboxEmailConfig {
	const domain = (env['GAUZY_INBOX_DOMAIN'] ?? '').trim().toLowerCase();
	const secret = (env['GAUZY_INBOX_PLATFORM_SECRET'] ?? '').trim();
	return {
		domain: domain || null,
		// A short secret is no secret: the platform route stays shut.
		platformSecret: secret.length >= 24 ? secret : null,
		maxMessageBytes: Math.floor(positive(env['GAUZY_INBOX_MAX_MESSAGE_BYTES'], DEFAULT_MAX_MESSAGE_BYTES)),
		spamSuspectScore: positive(env['GAUZY_INBOX_SPAM_SUSPECT_SCORE'], 5),
		spamQuarantineScore: positive(env['GAUZY_INBOX_SPAM_QUARANTINE_SCORE'], 10),
		inboundRequestsPerMinute: Math.floor(positive(env['GAUZY_INBOX_INBOUND_REQUESTS_PER_MINUTE'], 600)),
		workerEnabled: (env['GAUZY_INBOX_EMAIL_WORKER'] ?? '').trim().toLowerCase() !== 'off'
	};
}
