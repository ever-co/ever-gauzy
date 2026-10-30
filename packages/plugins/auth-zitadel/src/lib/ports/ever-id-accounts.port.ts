import { ZitadelLinkMethod } from '../entities/zitadel-account.entity';

/** One link between an Ever ID and a Gauzy user, as a connected-instance plugin reports it. */
export interface EverIdAccountLink {
	/** The link row (`zitadel_account.id`), the order of the pages. */
	id: string;
	userId: string;
	tenantId: string | null;
	/** The tenant's display name (never a person's name). */
	tenantName: string;
	issuer: string;
	subject: string;
	linkMethod: ZitadelLinkMethod;
}

/**
 * What this plugin offers a connected-instance plugin for a person's deletion or export request,
 * which names identities by `sha256(<issuer>#<subject>)` (lower-case hex) rather than by subject:
 *
 * - `findUsers`: the Gauzy users linked to any of those identities;
 * - `erase`: removes those links and ends the Gauzy sessions the users opened through Ever ID;
 *   returns the users the links belonged to. Nothing else of the users is changed;
 * - `links`: the existing links of the given tenants, a page at a time (after the link id `after`).
 *
 * Provided by this plugin under {@link EVER_ID_ACCOUNTS} when it is loaded.
 */
export interface EverIdAccountsPort {
	findUsers(subjectHashes: string[]): Promise<string[]>;
	erase(subjectHashes: string[]): Promise<string[]>;
	links(tenantIds: string[], after: string | null, limit: number): Promise<EverIdAccountLink[]>;
}

/** Injection token of {@link EverIdAccountsPort}. */
export const EVER_ID_ACCOUNTS = 'EVER_ID_ACCOUNTS';
