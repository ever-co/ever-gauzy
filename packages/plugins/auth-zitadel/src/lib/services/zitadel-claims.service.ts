import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { AUTH_ZITADEL_SETTINGS } from '../auth-zitadel.tokens';
import type { AuthZitadelSettings } from '../auth-zitadel.config';
import { EVER_CONNECT_CONFIG, EverConnectConfigPort, EverIdentityContext } from '../ports/ever-connect-config.port';

/** An organization the identity provider filtered out of this sign-in, with the reason. */
export interface ZitadelFilteredOrganization {
	id: string;
	handle?: string;
	reason?: string;
}

/** Hints read from the ID token. They only ever narrow access; they never grant any. */
export interface ZitadelClaimHints {
	personId?: string;
	identityKind?: string;
	enterpriseOrgId?: string;
	/** Organizations filtered out of this sign-in (for example one that requires its company sign-in). */
	filteredOrganizations: ZitadelFilteredOrganization[];
}

const CLAIM_PREFIX = 'urn:ever:';

/** How long a sign-in waits for Ever Platform's answer about an identity before it goes on without. */
export const RESOLVE_TIMEOUT_MS = 6_000;

/** What a sign-in reads from a verified ID token for its hints. */
export interface ZitadelClaimsSource {
	issuer: string;
	subject: string;
	claims: Record<string, unknown>;
}

/** Whether the token carries any of the platform's claims (`urn:ever:*`). */
export function hasPlatformClaims(claims: Record<string, unknown>): boolean {
	return Object.keys(claims).some((name) => name.startsWith(CLAIM_PREFIX));
}

function readString(claims: Record<string, unknown>, name: string): string | undefined {
	const value = claims[`${CLAIM_PREFIX}${name}`];
	return typeof value === 'string' && value ? value : undefined;
}

/**
 * Reads the optional platform hints of an ID token.
 *
 * The hints are optional: a token without them signs in exactly as before. They are parsed strictly:
 * an organization entry counts only when it carries an `id` string, so a token using any other field
 * name filters nothing rather than matching something by accident.
 *
 * {@link resolveFor} makes the one outbound call of this service, through the Ever Platform
 * connection plugin: only when the token carries none of the platform's claims, the connection
 * plugin is loaded (`EVER_CONNECT_ENABLED=true`) and offers it. That plugin asks Ever Platform only
 * for its own issuer while Sign in with Ever ID is enabled; a sign-in waits at most 6 seconds for
 * the answer and goes on without hints when there is none.
 */
@Injectable()
export class ZitadelClaimsService {
	private readonly logger = new Logger('AuthZitadelPlugin');

	constructor(
		@Optional() @Inject(AUTH_ZITADEL_SETTINGS) private readonly settings?: AuthZitadelSettings,
		@Optional() @Inject(EVER_CONNECT_CONFIG) private readonly everConnect?: EverConnectConfigPort
	) {}

	/**
	 * The hints of a verified ID token; when it carries none of the platform's claims, Ever Platform's
	 * view of the identity (see the class). Never throws and never waits longer than 6 seconds.
	 */
	async resolveFor(token: ZitadelClaimsSource): Promise<ZitadelClaimHints> {
		const hints = this.resolve(token.claims);
		const resolveIdentity = this.everConnect?.resolveIdentity;
		if (hasPlatformClaims(token.claims) || !resolveIdentity || !this.settings?.everConnectEnabled) {
			return hints;
		}
		let timer: NodeJS.Timeout | undefined;
		try {
			const context = await Promise.race([
				resolveIdentity.call(this.everConnect, token.issuer, token.subject),
				new Promise<null>((resolve) => {
					timer = setTimeout(() => resolve(null), RESOLVE_TIMEOUT_MS);
					timer.unref?.();
				})
			]);
			return context ? fromContext(context) : hints;
		} catch (error) {
			this.logger.warn(`Ever Platform's view of an identity is unavailable (${error instanceof Error ? error.name : 'error'}); signing in without it.`);
			return hints;
		} finally {
			if (timer) clearTimeout(timer);
		}
	}
	/**
	 * Extracts the hints from verified ID token claims.
	 *
	 * @param claims - The verified payload.
	 * @returns The hints (empty when absent).
	 */
	resolve(claims: Record<string, unknown>): ZitadelClaimHints {
		const filtered = claims[`${CLAIM_PREFIX}orgs_filtered`];
		const filteredOrganizations: ZitadelFilteredOrganization[] = [];
		if (Array.isArray(filtered)) {
			for (const entry of filtered) {
				if (entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>)['id'] === 'string') {
					const { id, handle, reason } = entry as Record<string, unknown>;
					filteredOrganizations.push({
						id: id as string,
						handle: typeof handle === 'string' ? handle : undefined,
						reason: typeof reason === 'string' ? reason : undefined
					});
				}
			}
		}
		return {
			personId: readString(claims, 'person_id'),
			identityKind: readString(claims, 'identity_kind'),
			enterpriseOrgId: readString(claims, 'enterprise_org_id'),
			filteredOrganizations
		};
	}
}

/** The hints of Ever Platform's view of an identity (the same strict reading as the claims). */
function fromContext(context: EverIdentityContext): ZitadelClaimHints {
	const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
	const filteredOrganizations: ZitadelFilteredOrganization[] = [];
	for (const entry of Array.isArray(context.orgs_filtered) ? context.orgs_filtered : []) {
		if (entry && typeof entry.id === 'string' && entry.id) {
			filteredOrganizations.push({ id: entry.id, handle: text(entry.handle), reason: text(entry.reason) });
		}
	}
	return {
		personId: text(context.person?.id),
		identityKind: text(context.identity?.kind),
		enterpriseOrgId: text(context.identity?.enterprise_org_id),
		filteredOrganizations
	};
}
