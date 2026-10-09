import { Injectable } from '@nestjs/common';

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

function readString(claims: Record<string, unknown>, name: string): string | undefined {
	const value = claims[`${CLAIM_PREFIX}${name}`];
	return typeof value === 'string' && value ? value : undefined;
}

/**
 * Reads the optional platform hints of an ID token.
 *
 * The hints are optional: a token without them signs in exactly as before. They are parsed strictly:
 * an organization entry counts only when it carries an `id` string, so a token using any other field
 * name filters nothing rather than matching something by accident. This service makes no outbound
 * call.
 */
@Injectable()
export class ZitadelClaimsService {
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
