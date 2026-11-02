import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EVER_ID_ACCOUNTS, EverIdAccountsPort } from '@gauzy/plugin-auth-zitadel';
import { EverConnectAuditService } from '../ever-connect-audit.service';
import { EverConnectIdentityStore, PersonRequestRecord } from '../ever-connect-identity.store';
import { EVER_CONNECT_CLOCK, EVER_CONNECT_ENV, IDENTITY_BATCH, LEASE_MS, ULID_SHAPE } from '../ever-connect.constants';
import { EverConnectPlatformService, errorCode, isCredentialRevoked, isUnreachable } from '../ever-connect-platform.service';
import { EverConnectSecretStore } from '../ever-connect-secret-store';
import { EverConnectSignals } from '../ever-connect-signals';
import { EventEnvelope, ProblemError } from '../sdk';
import { retryDelay } from '../reporters/person-link.reporter';
import { PersonDeletionHandler, PersonRequestAnswer } from './person-deletion.handler';
import { PersonExportHandler } from './person-export.handler';

/** The two request types, and the kind each one is. */
export const PERSON_REQUEST_TYPES: Readonly<Record<string, 'deletion' | 'export'>> = Object.freeze({
	'ever.registry.person.deletion_requested': 'deletion',
	'ever.registry.person.export_requested': 'export'
});

/** The kind of a person's request type, or `null` for any other type. */
export function personRequestKind(type: string): 'deletion' | 'export' | null {
	return Object.prototype.hasOwnProperty.call(PERSON_REQUEST_TYPES, type) ? PERSON_REQUEST_TYPES[type] : null;
}

/** A lower-case SHA-256 hex digest (`subject_hash`). */
const HASH_SHAPE = /^[0-9a-f]{64}$/;

/** How long a handling holds a request it works on, renewed while it runs (taken up again after that). */
export const REQUEST_CLAIM_MS = LEASE_MS;

/** How often a running handling renews its claim. */
const CLAIM_RENEW_MS = Math.floor(REQUEST_CLAIM_MS / 3);

/**
 * A person's deletion and export requests from the event feed, and this installation's answers
 * (`POST /v1/instances/me/ack`).
 *
 * Each request is recorded by its event id, with the identities it names, before it is handled, so a
 * request read twice (a replayed page, two API processes) is answered once. One handling claims it
 * at a time (renewing the claim while it runs, and writing only while it holds it); the Gauzy users
 * linked to its identities are looked up once and kept before any link is removed, so a handling that
 * stopped half-way (an error, a restart) is taken up again by the worker and answers for the same
 * accounts. The answer is sent at once; when Ever Platform cannot be reached
 * it is kept and sent again by the API process holding the connection's lease, with a back-off of up
 * to a day. Answers are not gated by any integration: a request already received stays answerable
 * after Sign in with Ever ID is switched off.
 */
@Injectable()
export class PersonRequestsHandler {
	private readonly logger = new Logger('EverConnect');
	private readonly now: () => number;
	private readonly secrets: EverConnectSecretStore;

	constructor(
		private readonly identity: EverConnectIdentityStore,
		private readonly platform: EverConnectPlatformService,
		private readonly deletion: PersonDeletionHandler,
		private readonly exports: PersonExportHandler,
		private readonly audit: EverConnectAuditService,
		private readonly signals: EverConnectSignals,
		@Optional() @Inject(EVER_ID_ACCOUNTS) private readonly accounts?: EverIdAccountsPort,
		@Optional() @Inject(EVER_CONNECT_ENV) env?: Record<string, string | undefined>,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.now = clock?.now ?? (() => Date.now());
		this.secrets = new EverConnectSecretStore(env ?? process.env);
	}

	/**
	 * Handles one request of the feed: records it, works out the answer and sends it. Returns `false`
	 * for an event that is not a well-formed request (it is acknowledged and ignored).
	 */
	async handle(event: EventEnvelope): Promise<boolean> {
		const kind = personRequestKind(event.type);
		const data = (event.data ?? {}) as Record<string, unknown>;
		const jobId = typeof data['job_id'] === 'string' ? data['job_id'] : '';
		if (!kind || typeof event.id !== 'string' || !ULID_SHAPE.test(event.id) || !ULID_SHAPE.test(jobId)) {
			return false;
		}
		const respondBy = Date.parse(String(data['respond_by'] ?? ''));
		await this.identity.addRequest({
			id: event.id,
			kind,
			jobId,
			respondBy: Number.isFinite(respondBy) ? respondBy : null,
			subjectHashes: subjectHashes(data)
		});
		await this.process(event.id);
		return true;
	}

	/**
	 * Takes up the requests whose handling stopped before an answer (by the API process holding the
	 * connection's lease). Returns how many were answered.
	 */
	async resumeDue(): Promise<number> {
		let answered = 0;
		for (const row of await this.identity.unansweredRequests(this.now() - REQUEST_CLAIM_MS, IDENTITY_BATCH)) {
			if (await this.process(row.id)) answered++;
		}
		return answered;
	}

	/** Sends the answers that are due again (by the API process holding the connection's lease). */
	async sendDue(): Promise<number> {
		let sent = 0;
		for (const row of await this.identity.dueRequests(this.now(), IDENTITY_BATCH)) {
			if (await this.send(row)) sent++;
		}
		return sent;
	}

	/** Works out and sends the answer of one recorded request, unless it has one or another handling holds it. */
	private async process(id: string): Promise<boolean> {
		const seen = await this.identity.request(id);
		const token = randomUUID();
		if (!seen || seen.result !== null || !(await this.identity.claimRequest(id, token, this.now() + REQUEST_CLAIM_MS))) {
			return false;
		}
		// Read again once held: another handling may have recorded the users before its claim ran out.
		let row = await this.identity.request(id);
		if (!row || row.result !== null || row.claimedBy !== token) {
			return false;
		}
		// The claim is renewed while the participant works (a large export may take a while).
		const renew = setInterval(() => {
			this.identity
				.updateClaimedRequest(id, token, {}, this.now() + REQUEST_CLAIM_MS)
				.catch((error) => this.logger.warn(`A person's request could not be held (${errorCode(error)}).`));
		}, CLAIM_RENEW_MS);
		renew.unref?.();
		let answer: PersonRequestAnswer;
		try {
			let userIds = row.userIds;
			if (userIds === null) {
				// Looked up once, before any link is removed, and kept: handled again, the answer is for the same accounts.
				userIds = this.accounts ? await this.accounts.findUsers(row.subjectHashes) : [];
				if (!(await this.identity.updateClaimedRequest(id, token, { userIds }))) {
					return false;
				}
			}
			let kept = userIds;
			const keepUsers = async (found: string[]): Promise<void> => {
				const merged = [...new Set([...kept, ...found])];
				if (merged.length === kept.length) return;
				if (!(await this.identity.updateClaimedRequest(id, token, { userIds: merged }))) {
					throw new Error("A person's request is no longer held by this handling.");
				}
				kept = merged;
			};
			const subject = { subjectHashes: row.subjectHashes, userIds, jobId: row.jobId, keepUsers };
			answer = await (row.kind === 'deletion' ? this.deletion : this.exports).answer(subject);
		} finally {
			clearInterval(renew);
		}
		const kept = await this.identity.updateClaimedRequest(id, token, {
			result: answer.result,
			reasonCode: answer.reasonCode ?? null,
			legalBasis: answer.legalBasis ?? null,
			exportUrlEncrypted: answer.exportUrl ? this.secrets.seal(answer.exportUrl, 'integration_config') : null,
			state: 'pending',
			nextAttemptAt: this.now(),
			claimedUntil: null
		});
		if (!kept) {
			// Another handling took it over (this one held it too long): its answer stands.
			return false;
		}
		await this.audit
			.record({
				action: 'person_request.answer',
				actorLabel: 'system',
				details: {
					job_id: row.jobId,
					op: row.kind,
					result: answer.result,
					count: answer.accounts,
					...(answer.reasonCode ? { reason: answer.reasonCode } : {})
				}
			})
			.catch((error) => this.logger.warn(`An answer to a person's request could not be audited (${errorCode(error)}).`));
		row = await this.identity.request(id);
		return row ? this.send(row) : false;
	}

	/** Sends one answer; returns whether Ever Platform took it. */
	private async send(row: PersonRequestRecord): Promise<boolean> {
		if (!row.result) {
			return false;
		}
		const body = this.ackBody(row);
		const attempts = row.attempts + 1;
		try {
			await (await this.platform.getClient()).instances.ack(body as never);
			await this.identity.updateRequest(row.id, {
				state: 'answered',
				answeredAt: this.now(),
				nextAttemptAt: null,
				attempts,
				lastError: null
			});
			return true;
		} catch (error) {
			if (isCredentialRevoked(error)) {
				this.signals.revoked$.next();
				return false;
			}
			const code = errorCode(error).replace(/\s+/g, '_').slice(0, 64);
			if (error instanceof ProblemError && error.status === 409 && error.code === 'receipt_final') {
				// Answered before, for good: nothing more to send.
				await this.identity.updateRequest(row.id, { state: 'answered', answeredAt: this.now(), nextAttemptAt: null, attempts, lastError: code });
				return true;
			}
			if (isUnreachable(error) || !(error instanceof ProblemError || (error instanceof Error && error.name === 'RequestRefusedError'))) {
				await this.identity.updateRequest(row.id, { nextAttemptAt: this.now() + retryDelay(attempts), attempts, lastError: code });
				return false;
			}
			// Refused for good (no such request for this installation, or an answer it does not take).
			await this.identity.updateRequest(row.id, { state: 'rejected', nextAttemptAt: null, attempts, lastError: code });
			this.logger.warn(`Ever Platform refused this installation's answer to a person's request (${code}).`);
			return false;
		}
	}

	/** `POST /v1/instances/me/ack`: the job, the answer, and only what that answer needs. */
	private ackBody(row: PersonRequestRecord): Record<string, unknown> {
		const exportUrl = row.result === 'exported' ? this.secrets.open(row.exportUrlEncrypted, 'integration_config') : null;
		return {
			job_id: row.jobId,
			result: row.result,
			...(row.result === 'failed' && row.reasonCode ? { detail: { reason_code: row.reasonCode } } : {}),
			...(row.result === 'retained_legal' && row.legalBasis ? { legal_basis: row.legalBasis } : {}),
			...(exportUrl ? { export_url: exportUrl } : {})
		};
	}
}

/** The identity hashes of a request: `subject_hashes`, else the one `subject_hash`. */
function subjectHashes(data: Record<string, unknown>): string[] {
	const many = Array.isArray(data['subject_hashes']) ? (data['subject_hashes'] as unknown[]) : [];
	const all = [...many, data['subject_hash']].filter((hash): hash is string => typeof hash === 'string' && HASH_SHAPE.test(hash));
	return [...new Set(all)];
}

export type { PersonRequestAnswer };
