import { randomInt } from 'node:crypto';
import { EverPlatformClient, OPERATIONS, OperationSpec } from '../sdk';
import { MembershipPosition, sameIssuer } from './membership-sync.config';

/**
 * The membership resync's reading side: `GET /v1/instances/me/tenant-links/{link}/memberships`, one page of the
 * current members of the Ever organization a tenant link points at, named as the membership events of the feed name
 * them (the Ever ID issuer and subject, the Gauzy user when Ever Platform has a person link, the Ever role; never an
 * e-mail or a person id). It is the re-read Ever Platform asks for after the feed answered `410 resync_required`, and
 * answers `404 module_disabled` while Ever Platform sends no membership events.
 *
 * The pinned SDK (`1.0.0-rc.8`) has no method for this route yet, so its operation is added to the SDK's own
 * operation table, as the published contract describes it, the first time it is needed: the call then goes through
 * the SDK client like every other one (the installation's token, its timeouts, redirect refusal and problem
 * documents). A later SDK that ships the operation keeps its own entry.
 */
export const LINK_MEMBERSHIPS_OPERATION = 'instanceListLinkMemberships';

/** The largest page the route answers. */
export const LINK_MEMBERSHIPS_PAGE_SIZE = 100;

/** At most this many pages of one link's list are read (100 members each). */
export const MEMBERSHIP_RESYNC_MAX_PAGES = 1_000;

const SPEC: OperationSpec = {
	id: LINK_MEMBERSHIPS_OPERATION,
	method: 'GET',
	path: '/v1/instances/me/tenant-links/{link}/memberships',
	pathParams: ['link'],
	query: ['cursor', 'limit'],
	auth: 'instance',
	idempotencyKey: 'none',
	linkHeader: 'none',
	conditional: false,
	body: null,
	success: [200],
	row: 0,
	integration: null,
	rateLimit: 'instance',
	status: 'provisional'
};

/** One page as the route answers it (each item is checked by the caller). */
export interface LinkMembershipsPage {
	items: unknown[];
	nextCursor: string | null;
}

/** Thrown for an answer that is not a page. */
export class LinkMembershipsAnswerError extends Error {
	readonly code = 'malformed_page';
	constructor() {
		super('The membership list answered something that is not a page.');
		this.name = 'LinkMembershipsAnswerError';
	}
}

type Call = (
	id: string,
	input: { path: Record<string, string>; query: Record<string, string | number | undefined> }
) => Promise<unknown>;

/** Adds the operation to the SDK's table, unless the SDK has it already. */
export function ensureLinkMembershipsOperation(
	table: Record<string, OperationSpec> = OPERATIONS as unknown as Record<string, OperationSpec>
): void {
	if (!Object.prototype.hasOwnProperty.call(table, LINK_MEMBERSHIPS_OPERATION)) {
		table[LINK_MEMBERSHIPS_OPERATION] = SPEC;
	}
}

/**
 * Reads one page of the members of the tenant link `linkId` (Ever Platform's id of the link), after `cursor` (`null`
 * for the first page). A failure is the SDK's own error (`ProblemError` with `status` and `code`, ...).
 */
export async function readLinkMembershipsPage(
	client: Pick<EverPlatformClient, 'call'>,
	linkId: string,
	cursor: string | null
): Promise<LinkMembershipsPage> {
	ensureLinkMembershipsOperation();
	const answer = await (client.call as unknown as Call)(LINK_MEMBERSHIPS_OPERATION, {
		path: { link: linkId },
		query: { limit: LINK_MEMBERSHIPS_PAGE_SIZE, cursor: cursor ?? undefined }
	});
	if (!answer || typeof answer !== 'object') throw new LinkMembershipsAnswerError();
	const { items, next_cursor } = answer as { items?: unknown; next_cursor?: unknown };
	if (!Array.isArray(items)) throw new LinkMembershipsAnswerError();
	if (next_cursor !== undefined && next_cursor !== null && typeof next_cursor !== 'string') {
		throw new LinkMembershipsAnswerError();
	}
	return { items, nextCursor: typeof next_cursor === 'string' && next_cursor !== '' ? next_cursor : null };
}

/** One member of a linked Ever organization, as the membership list names them. */
export interface CurrentMember {
	issuer: string;
	subject: string;
	userRef: string | null;
	role: string;
}

const EXTERNAL_ID = /^[A-Za-z0-9._:-]{1,64}$/;
const PRODUCT_ID = /^[A-Za-z0-9._:*-]{1,64}$/;

/** One item of the membership list, checked as an event's data is; `null` when it is not one. */
export function parseCurrentMember(item: unknown): CurrentMember | null {
	if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
	const { identity_issuer, identity_subject, product_user_ref, role } = item as Record<string, unknown>;
	if (typeof identity_issuer !== 'string' || !isHttpsUrl(identity_issuer)) return null;
	if (typeof identity_subject !== 'string' || !EXTERNAL_ID.test(identity_subject)) return null;
	if (
		product_user_ref !== undefined &&
		product_user_ref !== null &&
		(typeof product_user_ref !== 'string' || !PRODUCT_ID.test(product_user_ref))
	) {
		return null;
	}
	if (typeof role !== 'string') return null;
	return {
		issuer: identity_issuer,
		subject: identity_subject,
		userRef: typeof product_user_ref === 'string' ? product_user_ref : null,
		role
	};
}

/** An Ever ID as compared: the issuer (without trailing slashes) and the subject. */
export function identityKey(issuer: string, subject: string): string {
	return `${sameIssuer(issuer)}#${subject}`;
}

/**
 * Who the membership list of a linked organization named, gathered while it is read page by page: the Gauzy users
 * the members resolved to (or that Ever Platform's person links name), their Ever IDs and the issuers those come from.
 */
export class ListedMembers {
	readonly userIds = new Set<string>();
	readonly identities = new Set<string>();
	readonly issuers = new Set<string>();

	add(member: CurrentMember, userId: string | null): void {
		this.issuers.add(sameIssuer(member.issuer));
		this.identities.add(identityKey(member.issuer, member.subject));
		if (userId) this.userIds.add(userId);
		if (member.userRef) this.userIds.add(member.userRef);
	}
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * The position a change made by a resync takes: right after the last change applied for the user in the organization
 * (the same time, the next id), so the next event of the feed is still applied after it. With no change applied yet,
 * before every event: time 0 and an id of time 0 with a random part (the id may become the id of a grant, which must
 * not be another one's).
 */
export function positionAfter(last: MembershipPosition | null): MembershipPosition {
	if (!last) {
		let random = '';
		for (let i = 0; i < 16; i += 1) random += CROCKFORD[randomInt(CROCKFORD.length)];
		return { eventId: `0000000000${random}`, occurredAt: 0 };
	}
	const next = nextId(last.eventId.toUpperCase());
	return next
		? { eventId: next, occurredAt: last.occurredAt }
		: { eventId: '0'.repeat(26), occurredAt: (last.occurredAt ?? 0) + 1 };
}

/** The ULID right after `id` (Crockford base32, one more), or `null` past the last one. */
function nextId(id: string): string | null {
	const digits = id.split('');
	for (let i = digits.length - 1; i >= 0; i -= 1) {
		const value = CROCKFORD.indexOf(digits[i]);
		if (value < 0) return null;
		if (value < CROCKFORD.length - 1) {
			digits[i] = CROCKFORD[value + 1];
			return digits.join('');
		}
		digits[i] = '0';
	}
	return null;
}

function isHttpsUrl(value: string): boolean {
	if (value.length > 2048) return false;
	try {
		return new URL(value).protocol === 'https:';
	} catch {
		return false;
	}
}
