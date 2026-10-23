import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { In } from 'typeorm';
import {
	TermsAcceptanceService as Recorder,
	assertPublishedText,
	selectRequiredDocuments,
	type AcceptanceMethod,
	type AcceptanceRecord,
	type CorpusIndex,
	type RequiredDocument
} from 'terms-acceptance';
import { TypeOrmAcceptanceAdapter } from 'terms-acceptance/typeorm';
import { ITermsAcceptanceClaim, ITermsAcceptanceDocument } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TypeOrmTermsAcceptanceRepository } from './repository/type-orm-terms-acceptance.repository';

/**
 * The published legal corpus.
 *
 * Loaded with `require` rather than a JSON `import` on purpose: the repo compiles
 * with `moduleResolution: "node"` and without `resolveJsonModule`, and
 * `@ever-co/legal` exposes its index only through its `exports` map — the
 * on-disk path `dist/index.json` is deliberately not importable. `require` is
 * the one specifier that both TypeScript and Node agree on here.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const corpus = require('@ever-co/legal/index.json') as CorpusIndex;

/** The product id this deployment publishes under in the legal corpus. */
export const TERMS_PRODUCT = 'gauzy';

/** The most documents one acceptance may name; the corpus publishes a handful per product. */
export const MAX_CLAIMS_PER_ACCEPTANCE = 20;

/**
 * Records terms-of-service acceptance.
 *
 * ## What this exists to fix
 *
 * The register form has always rendered a hard-required "I agree to the Terms"
 * checkbox and used it to enable the submit button — and then
 * `AuthStrategy.register()` destructured the payload and dropped it, the DTO had
 * no field for it, and no table had a column for it. The user saw a checkbox;
 * the database had nothing. Asked *which version of the Terms did this customer
 * accept, and what did the text say at the time?* there was no answer and no way
 * to construct one. The invite-acceptance form had the identical defect.
 *
 * ## How a record becomes evidence
 *
 * A row carries the `sha256` of the document *source* as published by
 * `@ever-co/legal`. Years later that digest can be recomputed from the corpus at
 * the matching tag and compared byte for byte, which is the difference between
 * "we believe they accepted v1" and being able to show the text they accepted.
 *
 * Because the digest arrives from a browser, it is a *claim* until the server
 * has checked it. Passing `corpus` to the recorder makes every write go through
 * `assertPublishedText`, so an acceptance can never point at text the corpus
 * never published — a bug (or a forged request) fails loudly instead of writing
 * evidence that means nothing.
 */
@Injectable()
export class TermsAcceptanceService {
	private readonly logger = new Logger(TermsAcceptanceService.name);
	private readonly recorder: Recorder;

	constructor(private readonly typeOrmTermsAcceptanceRepository: TypeOrmTermsAcceptanceRepository) {
		this.recorder = new Recorder({
			adapter: new TypeOrmAcceptanceAdapter({
				repository: this.typeOrmTermsAcceptanceRepository,
				In
			}),
			// Every write is checked against the published corpus.
			corpus,
			// Per-deployment secret. Without it `hashIp` returns null and no IP
			// is recorded at all, which is a legitimate configuration — an
			// *unsalted* IP hash would not be, since all 2^32 IPv4 addresses can
			// be enumerated in seconds.
			ipSalt: process.env.TERMS_IP_SALT
			// `materiality` is left at the default `'declared-or-semver'`. The
			// corpus does not yet declare a `history` per document; switching to
			// `'declared'` before it does would throw on every status check.
		});
	}

	/**
	 * The documents a user must accept, straight from the corpus.
	 *
	 * The server publishes these so the client never has to guess a version or a
	 * digest — and so the value that gates the submit button is the same value
	 * that comes back on submit.
	 */
	public getRequiredDocuments(locale?: string): ITermsAcceptanceDocument[] {
		const documents = selectRequiredDocuments(corpus, {
			product: TERMS_PRODUCT,
			locale,
			url: (doc) => `/legal/${doc.document}`
		});

		return documents.map(
			({ documentId, version, sha256, locale: docLocale, url, title, effectiveDate }): ITermsAcceptanceDocument => ({
				documentId,
				version,
				sha256,
				locale: docLocale,
				url,
				title,
				effectiveDate
			})
		);
	}

	/**
	 * Record the acceptance a signup or invite-acceptance form collected.
	 *
	 * Idempotent per `(subject, tenant, document, version)`: a double-submitted
	 * form returns the record that already exists rather than writing a second
	 * one, so two pieces of evidence can never disagree about the time.
	 *
	 * @param subjectId The user the acceptance belongs to.
	 * @param claims What the form says it displayed. Validated against the corpus.
	 * @param context Tenant scope, client IP, user-agent and how consent was obtained.
	 */
	public async record(
		subjectId: string,
		claims: ITermsAcceptanceClaim[],
		context: {
			tenantId?: string | null;
			method: AcceptanceMethod;
			ip?: string | null;
			userAgent?: string | null;
			metadata?: Record<string, unknown> | null;
		}
	): Promise<AcceptanceRecord[]> {
		const documents: RequiredDocument[] = claims.map(({ documentId, version, sha256, locale }) => ({
			documentId,
			version,
			sha256,
			locale
		}));

		return this.recorder.recordMany(documents, {
			subjectId,
			tenantId: context.tenantId ?? null,
			method: context.method,
			ipHash: this.recorder.hashIp(context.ip),
			userAgent: context.userAgent ?? null,
			metadata: context.metadata ?? null
		});
	}

	/**
	 * Validate claims *before* anything irreversible happens.
	 *
	 * Called ahead of user creation so a missing, malformed or unpublished claim
	 * rejects the registration outright instead of leaving a half-created account
	 * behind. `assertPublishedText` is pure and synchronous — no storage, no
	 * clock, no network — so this is cheap enough to run on the hot path.
	 *
	 * @throws BadRequestException when a claim does not match published text.
	 */
	public assertClaimsArePublished(claims: ITermsAcceptanceClaim[]): void {
		for (const claim of claims) {
			try {
				// Checks the digest against every rendering the corpus
				// publishes for that document and version — not just the
				// default-locale one — so a user who read the text in their own
				// language is pinned to the text they actually read.
				assertPublishedText(corpus, claim.documentId, claim.version, claim.sha256);
			} catch (error) {
				this.logger.warn(
					`Rejected terms acceptance for unpublished text: ${claim.documentId}@${claim.version} — ${
						error instanceof Error ? error.message : String(error)
					}`
				);
				throw new BadRequestException(
					`Terms acceptance references text that was never published: ${claim.documentId}@${claim.version}.`
				);
			}
		}
	}

	/** Every acceptance on file for a user, newest first, integrity-checked. */
	public async history(subjectId: string, tenantId?: string | null): Promise<AcceptanceRecord[]> {
		return this.recorder.history({ subjectId, tenantId: tenantId ?? null });
	}

	/**
	 * Record the caller's own acceptance of the documents it was shown — the re-accept path for an account
	 * that already exists, when a document it accepted at signup has since been republished.
	 *
	 * The subject and the tenant are the credential's and never a member a caller can state, so nobody can
	 * accept on someone else's behalf. The claims are checked against the published corpus *before* the
	 * recorder runs, so a digest the corpus never published is a `400` naming the document rather than an
	 * error from inside the recorder; the recorder then re-checks every one on write. Recording is
	 * idempotent per `(subject, tenant, document, version)`, so a double-submitted form answers the records
	 * that already exist.
	 *
	 * `method` is `api`: this is the authenticated endpoint, and the server cannot tell which form a client
	 * rendered. The client address is salted and hashed exactly as the signup path does it, and the
	 * user-agent is the request's own.
	 *
	 * @param claims What the client says it displayed.
	 * @returns The acceptance records, one per claim.
	 * @throws UnauthorizedException when the request carries no user.
	 * @throws BadRequestException when a claim does not match published text.
	 */
	public async acceptAsCaller(claims: ITermsAcceptanceClaim[]): Promise<AcceptanceRecord[]> {
		const subjectId = RequestContext.currentUserId();

		if (!subjectId) {
			throw new UnauthorizedException();
		}

		// The REST body is capped by its DTO; the GraphQL input is not validated by one, so the bound that keeps
		// one request from asking the recorder for an unbounded batch is stated here, once, for both.
		if (!Array.isArray(claims) || claims.length === 0 || claims.length > MAX_CLAIMS_PER_ACCEPTANCE) {
			throw new BadRequestException(
				`Terms acceptance must list between 1 and ${MAX_CLAIMS_PER_ACCEPTANCE} documents.`
			);
		}

		this.assertClaimsArePublished(claims);

		const request = RequestContext.currentRequest();

		return this.record(subjectId, claims, {
			tenantId: RequestContext.currentTenantId() ?? null,
			method: 'api',
			ip: request?.ip ?? null,
			userAgent: (request?.headers?.['user-agent'] as string | undefined) ?? null
		});
	}

	/**
	 * Every acceptance on file for the caller in the caller's tenant, newest first, integrity-checked.
	 *
	 * The subject and the tenant are the credential's, so this read answers "what have I accepted here?"
	 * and nothing else — another user's evidence is not reachable through it.
	 *
	 * @throws UnauthorizedException when the request carries no user.
	 */
	public async historyOfCaller(): Promise<AcceptanceRecord[]> {
		const subjectId = RequestContext.currentUserId();

		if (!subjectId) {
			throw new UnauthorizedException();
		}

		return this.history(subjectId, RequestContext.currentTenantId() ?? null);
	}
}
