import { createHmac, timingSafeEqual } from 'node:crypto';
import { JIRA_WEBHOOK_CLOCK_LEEWAY_SECONDS } from './jira.constants';

/** The claims of a webhook token the receiver reads (Jira signs more; none of the others is needed). */
export interface JiraWebhookTokenClaims {
	iss?: string;
	sub?: string;
	aud?: string | string[];
	exp?: number;
	iat?: number;
	nbf?: number;
	[claim: string]: unknown;
}

export type JiraWebhookTokenCheck =
	| { valid: true; claims: JiraWebhookTokenClaims }
	| { valid: false; reason: 'missing' | 'malformed' | 'algorithm' | 'signature' | 'expired' | 'not_yet_valid' };

function base64UrlDecode(part: string): Buffer | null {
	if (!/^[A-Za-z0-9_-]*$/.test(part)) return null;
	try {
		return Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
	} catch {
		return null;
	}
}

function json<T>(buffer: Buffer | null): T | null {
	if (!buffer) return null;
	try {
		const value = JSON.parse(buffer.toString('utf8'));
		return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : null;
	} catch {
		return null;
	}
}

/**
 * Whether a dynamic webhook delivery is Jira's: an OAuth 2.0 app's webhooks carry `Authorization: Bearer <JWT>`, the
 * token signed (HS256) with the app's client secret. The signature is compared in constant time; a token that names
 * another algorithm (`none`, an asymmetric one the secret would be misread as a key of) is refused, and so is one
 * whose `exp` passed or whose `nbf` / `iat` is still ahead, beyond a minute of clock difference. A token without `exp`
 * is accepted on its signature (the delivery id still makes a replay a no-op).
 */
export function verifyJiraWebhookToken(secret: string, authorization: string | undefined, nowMs = Date.now()): JiraWebhookTokenCheck {
	const header = authorization?.trim();
	if (!header) return { valid: false, reason: 'missing' };
	const match = /^(?:Bearer|JWT)\s+([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/i.exec(header);
	if (!match) return { valid: false, reason: 'malformed' };
	const [, encodedHeader, encodedPayload, encodedSignature] = match;
	const jose = json<{ alg?: string; typ?: string }>(base64UrlDecode(encodedHeader));
	const claims = json<JiraWebhookTokenClaims>(base64UrlDecode(encodedPayload));
	const signature = base64UrlDecode(encodedSignature);
	if (!jose || !claims || !signature) return { valid: false, reason: 'malformed' };
	if (jose.alg !== 'HS256') return { valid: false, reason: 'algorithm' };
	const expected = createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest();
	if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return { valid: false, reason: 'signature' };
	const now = Math.floor(nowMs / 1000);
	const leeway = JIRA_WEBHOOK_CLOCK_LEEWAY_SECONDS;
	if (typeof claims.exp === 'number' && Number.isFinite(claims.exp) && now > claims.exp + leeway) return { valid: false, reason: 'expired' };
	if (typeof claims.nbf === 'number' && Number.isFinite(claims.nbf) && now + leeway < claims.nbf) return { valid: false, reason: 'not_yet_valid' };
	if (typeof claims.iat === 'number' && Number.isFinite(claims.iat) && now + leeway < claims.iat) return { valid: false, reason: 'not_yet_valid' };
	return { valid: true, claims };
}

/** The part of a Jira webhook delivery the integration reads. */
export interface JiraWebhookPayload {
	timestamp?: number;
	webhookEvent?: string;
	issue_event_type_name?: string;
	issue?: { id?: string | number; key?: string; fields?: { project?: { id?: string | number } | null } | null } | null;
	comment?: { id?: string | number } | null;
	matchedWebhookIds?: Array<number | string>;
}

/** The events after which the issue is read again: a created or changed issue, and a comment added or edited on it. */
const ISSUE_EVENTS = new Set(['jira:issue_created', 'jira:issue_updated', 'comment_created', 'comment_updated']);

/**
 * The issue a delivery is about, and its project when the delivery says it (the issue is read again from Jira either
 * way: a delivery's fields are a snapshot, the read is what the issue is now). A deleted issue, a deleted comment and
 * any other event are nothing to apply: the task stays as it was.
 */
export function issueOfDelivery(payload: Pick<JiraWebhookPayload, 'webhookEvent' | 'issue'>): { issueId: string; projectId: string | null } | null {
	if (!payload.webhookEvent || !ISSUE_EVENTS.has(payload.webhookEvent)) return null;
	const id = payload.issue?.id;
	if (id === undefined || id === null || !/^\d{1,20}$/.test(String(id))) return null;
	const project = payload.issue?.fields?.project?.id;
	return { issueId: String(id), projectId: project === undefined || project === null ? null : String(project) };
}

/**
 * Whether the delivery came through one of the connection's webhooks: a delivery names the webhooks it matched
 * (`matchedWebhookIds`); one that names only webhooks the connection does not hold (a former registration) is not the
 * connection's. A delivery that names none, or a connection that records none, is not refused on this alone.
 */
export function isDeliveryForWebhooks(payload: Pick<JiraWebhookPayload, 'matchedWebhookIds'>, webhookIds: readonly string[]): boolean {
	const matched = (payload.matchedWebhookIds ?? []).map(String);
	if (!matched.length || !webhookIds.length) return true;
	return matched.some((id) => webhookIds.includes(id));
}

/** The delivery id Jira keeps across the retries of one delivery (`X-Atlassian-Webhook-Identifier`), or null. */
export function deliveryIdOf(header: string | string[] | undefined): string | null {
	const value = Array.isArray(header) ? header[0] : header;
	const id = value?.trim();
	return id && /^[A-Za-z0-9._:-]{1,128}$/.test(id) ? id : null;
}

/** A helper for the specs and for a test double of Jira: a token as Jira signs it. */
export function signJiraWebhookToken(secret: string, claims: JiraWebhookTokenClaims, alg = 'HS256'): string {
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
	const head = encode({ alg, typ: 'JWT' });
	const body = encode(claims);
	const signature = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
	return `${head}.${body}.${signature}`;
}
