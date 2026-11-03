import { ITermsAcceptanceClaim, ITermsAcceptanceDocument, LanguagesEnum } from '@gauzy/contracts';

/**
 * Port for creating a Gauzy workspace whose owner is already linked to an Ever ID.
 *
 * Provided by this plugin under {@link ZITADEL_PROVISIONER}. It is called only by a connected-instance
 * plugin after the person confirmed creating the workspace (a signed request from Ever Platform, the
 * person's own Ever ID sign-in, and their click); no code path of this plugin calls it by itself.
 */
export interface CreateUserPreLinkedInput {
	issuer: string;
	subject: string;
	everPersonId?: string;
	/** The verified e-mail of the person's own Ever ID sign-in (never from another source). */
	email: string;
	firstName?: string;
	lastName?: string;
	tenant: { name: string };
	organization: { name: string; officialName?: string; country?: string; currency?: string; website?: string };
	everOrgId: string;
	everTenantId: string;
	handle: string;
	tenantLinkId?: string;
	options: {
		createEmployee: boolean;
		/** Also create a team named after the organization, with the owner's employee in it (needs `createEmployee`). */
		createTeam?: boolean;
	};
	/**
	 * The documents the person accepted on the confirmation page (as `requiredTerms` listed them); every
	 * required one must be there, and Gauzy's register path checks and records them.
	 */
	terms?: ITermsAcceptanceClaim[];
	/** Replays with the same key return the ids of the first call. */
	idempotencyKey: string;
}

export interface CreateUserPreLinkedResult {
	userId: string;
	tenantId: string;
	organizationId: string;
	employeeId?: string;
	teamId?: string;
	/** `true` when an earlier call with the same key had finished: nothing new was created. */
	existing?: boolean;
}

/** A statement runner inside the transaction that writes the links (the caller's own rows join it). */
export interface ProvisionTransaction {
	query(sql: string, params?: unknown[]): Promise<unknown>;
}

/**
 * What the caller adds to a creation:
 *
 * - `resume`: the ids an earlier attempt with the same key created before it stopped (the caller keeps
 *   them, see `checkpoint`), so a retry finishes that workspace instead of starting another;
 * - `checkpoint`: called with the ids known so far after each step; a failure stops the creation;
 * - `finalize`: runs inside the one transaction that writes the organization link and the owner's
 *   Ever ID link (the last step, after which the owner can sign in); when it fails, neither is written.
 */
export interface CreateUserPreLinkedHooks {
	resume?: Partial<CreateUserPreLinkedResult>;
	checkpoint?(ids: Partial<CreateUserPreLinkedResult>): Promise<void>;
	finalize?(tx: ProvisionTransaction, ids: CreateUserPreLinkedResult): Promise<void>;
}

export interface ZitadelProvisionerPort {
	createUserPreLinked(
		input: CreateUserPreLinkedInput,
		hooks?: CreateUserPreLinkedHooks
	): Promise<CreateUserPreLinkedResult>;
	/** The ids of a creation that finished with this key, or `null`. */
	findProvisioned(idempotencyKey: string): Promise<CreateUserPreLinkedResult | null>;
	/** Whether an Ever organization is already linked to a workspace by a creation with another key. */
	isLinkedElsewhere(everOrgId: string, idempotencyKey: string): Promise<boolean>;
	/** The legal documents a new owner must accept (Gauzy's own list), with absolute links to the web app's pages. */
	requiredTerms(locale?: LanguagesEnum): ITermsAcceptanceDocument[];
}

/** Injection token of {@link ZitadelProvisionerPort}. */
export const ZITADEL_PROVISIONER = 'ZITADEL_PROVISIONER';
