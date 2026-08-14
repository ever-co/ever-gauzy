/**
 * Terms-of-service acceptance.
 *
 * A checkbox is not consent — it is a *claim* that consent happened. Until the
 * registration payload actually carries which document, at which version, of
 * which exact text the person agreed to, the tick is unprovable: the user saw a
 * checkbox and the database has nothing.
 *
 * These two shapes are the two halves of making it provable:
 *
 * - {@link ITermsAcceptanceDocument} is what the *server* publishes — derived
 *   from the legal corpus (`@ever-co/legal`), so the client never has to guess a
 *   version or a digest.
 * - {@link ITermsAcceptanceClaim} is what the *client* posts back — the exact
 *   identity of the text it rendered next to the checkbox. The server re-checks
 *   every claim against the corpus before it becomes a record, because a value
 *   that arrived from a browser is a claim, not evidence.
 */

/**
 * One document the user must accept, as published by the legal corpus.
 *
 * `sha256` is the digest of the document source. It is what makes an acceptance
 * reproducible years later: check the corpus out at that version, re-run the
 * build, re-hash, compare.
 */
export interface ITermsAcceptanceDocument {
	/** Stable document identifier, `<document>:<product>` — e.g. `tos:gauzy`. */
	documentId: string;
	/** Published version of the document, e.g. `1.0.0`. */
	version: string;
	/** Lowercase hex sha256 (64 chars) of the exact document source. */
	sha256: string;
	/** BCP-47 locale of the rendering that is being shown. */
	locale: string;
	/** Where the user can read it. */
	url?: string;
	/** Human title for the checkbox / modal. */
	title?: string;
	/** ISO date this version takes effect. */
	effectiveDate?: string;
}

/**
 * What a signup / invite-acceptance form posts back for one document.
 *
 * Deliberately the same fields the server published, echoed verbatim: if the two
 * disagree the server rejects the registration rather than recording an
 * acceptance that points at text nobody ever published.
 */
export interface ITermsAcceptanceClaim {
	documentId: string;
	version: string;
	sha256: string;
	locale: string;
}

/**
 * Anything that can carry terms acceptance evidence alongside its own payload.
 */
export interface ITermsAcceptanceInput {
	/**
	 * The documents the user ticked the box for, exactly as they were shown.
	 * Required for interactive signup; absent for machine-driven registration
	 * (imports, seeds, SUPER_ADMIN provisioning), where a checkbox never existed
	 * and inventing one would be worse than recording nothing.
	 */
	terms?: ITermsAcceptanceClaim[];
}
