import { isEverConnectEnabled } from '../ever-connect-enabled';

/**
 * The switch, the event types and the role mapping of the membership sync: the membership changes Ever Platform
 * sends on the installation's feed for an Ever organization linked to a Gauzy organization here. Kept free of
 * framework imports so the module can decide whether to register the handler while it is being built.
 */

type Env = Record<string, string | undefined>;
type Warn = (message: string) => void;

/** The environment variable of the switch. */
export const MEMBERSHIP_SYNC_SWITCH = 'EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED';

/**
 * `EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED`: only the exact value `true` turns the membership sync on, and only on an
 * installation that loads the Ever Platform connection (`EVER_CONNECT_ENABLED=true`) and the Ever ID sign-in plugin
 * (`ZITADEL_ENABLED=true`), whose links say which Gauzy user an Ever ID is. Unset, empty and `false` keep it off
 * silently; any other value keeps it off with one warning that never repeats the value.
 */
export function isMembershipSyncEnabled(env: Env = process.env, warn: Warn = () => undefined): boolean {
	if (!isEverConnectEnabled(env)) {
		return false;
	}
	const raw = env[MEMBERSHIP_SYNC_SWITCH];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw !== 'true') {
		warn(`${MEMBERSHIP_SYNC_SWITCH} is neither "true" nor "false"; the membership sync stays off (the default).`);
		return false;
	}
	if (env['ZITADEL_ENABLED'] !== 'true') {
		warn(`${MEMBERSHIP_SYNC_SWITCH}=true has no effect without Ever ID sign-in (ZITADEL_ENABLED=true).`);
		return false;
	}
	return true;
}

/** What a membership event says happened. */
export type MembershipChange = 'created' | 'role_changed' | 'removed';

/** The membership changes Ever Platform sends, and what each one is. */
export const MEMBERSHIP_TOPICS: Readonly<Record<string, MembershipChange>> = Object.freeze({
	'ever.registry.membership.created': 'created',
	'ever.registry.membership.role_changed': 'role_changed',
	'ever.registry.membership.removed': 'removed'
});

/** The change a feed event type stands for, or `null` for any other type. */
export function membershipChangeOf(type: string): MembershipChange | null {
	return Object.prototype.hasOwnProperty.call(MEMBERSHIP_TOPICS, type) ? MEMBERSHIP_TOPICS[type] : null;
}

/** The roles of an Ever organization. */
export type EverRole = 'owner' | 'admin' | 'member';

/** The Gauzy role names the sync works with (`RolesEnum` values). */
export const GAUZY_SUPER_ADMIN = 'SUPER_ADMIN';
export const GAUZY_ADMIN = 'ADMIN';

/**
 * Ever roles, as the Gauzy role the sync grants (`null`: none). Gauzy roles are the tenant's: the user of the
 * tenant the link is for gets the role.
 *
 * - `owner` and `admin` → `ADMIN`. `SUPER_ADMIN` is the tenant owner's (made when the workspace was created) and
 *   is never granted, changed or taken by the sync, as Ever Works never grants its owner role: an Ever owner is
 *   an administrator here.
 * - `member` → no role: the user keeps the role they have here (Ever Works' base `member` role). A demotion to
 *   member takes away only an `ADMIN` the sync granted, and gives the role the user had before it back.
 *
 * Any other role changes nothing.
 */
export const EVER_ROLE_TO_GAUZY_ROLE: Readonly<Record<EverRole, typeof GAUZY_ADMIN | null>> = Object.freeze({
	owner: GAUZY_ADMIN,
	admin: GAUZY_ADMIN,
	member: null
});

/** Whether `role` is one of the Ever roles. */
export function isEverRole(role: string): role is EverRole {
	return Object.prototype.hasOwnProperty.call(EVER_ROLE_TO_GAUZY_ROLE, role);
}

/** One membership event, as the installation's feed carries it (one per tenant link). */
export interface MembershipEventData {
	/** The tenant link on Ever Platform (`ever_connect_link.linkId`). */
	linkId: string;
	/** The Ever ID the person signs in with: its issuer and subject. */
	issuer: string;
	subject: string;
	/** The Gauzy user Ever Platform's person link names, when one exists. */
	userRef: string | null;
	/** The Ever role, as sent (checked against the mapping later). */
	role: string;
}

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const EXTERNAL_ID = /^[A-Za-z0-9._:-]{1,64}$/;
const PRODUCT_ID = /^[A-Za-z0-9._:*-]{1,64}$/;

/**
 * The installation's shape of a membership event (`tenant_link_id`, `identity_issuer`, `identity_subject`,
 * optional `product_user_ref`, `role`), or `null` when `data` is not one (the organization's own shape, with
 * `org_id` and `person_id`, never reaches an installation and is not one either).
 */
export function parseMembershipData(data: unknown): MembershipEventData | null {
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return null;
	}
	const record = data as Record<string, unknown>;
	const { tenant_link_id, identity_issuer, identity_subject, product_user_ref, role } = record;
	if (typeof tenant_link_id !== 'string' || !ULID.test(tenant_link_id)) return null;
	if (typeof identity_issuer !== 'string' || !isHttpsUrl(identity_issuer)) return null;
	if (typeof identity_subject !== 'string' || !EXTERNAL_ID.test(identity_subject)) return null;
	if (
		product_user_ref !== undefined &&
		(typeof product_user_ref !== 'string' || !PRODUCT_ID.test(product_user_ref))
	) {
		return null;
	}
	if (typeof role !== 'string') return null;
	return {
		linkId: tenant_link_id,
		issuer: identity_issuer,
		subject: identity_subject,
		userRef: typeof product_user_ref === 'string' ? product_user_ref : null,
		role
	};
}

/** An issuer as compared: without trailing slashes (`https://id.example/` and `https://id.example` are one). */
export function sameIssuer(issuer: string): string {
	return issuer.replace(/\/+$/, '');
}

function isHttpsUrl(value: string): boolean {
	if (value.length > 2048) return false;
	try {
		return new URL(value).protocol === 'https:';
	} catch {
		return false;
	}
}

/** Where an event stands in the order of a person's changes: its time (`occurred_at`), then its id (a ULID). */
export interface MembershipPosition {
	eventId: string;
	occurredAt: number | null;
}

/** Whether `next` comes after `last`: by time when both have one and they differ, otherwise by id. */
export function isAfter(next: MembershipPosition, last: MembershipPosition): boolean {
	if (next.occurredAt !== null && last.occurredAt !== null && next.occurredAt !== last.occurredAt) {
		return next.occurredAt > last.occurredAt;
	}
	// ULIDs are Crockford base32, case-insensitive: compared in one case, their order is their time order.
	return next.eventId.toUpperCase() > last.eventId.toUpperCase();
}
