import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EverConnectAuditService } from '../ever-connect-audit.service';
import { EverConnectIdentityStore, PersonRequestRecord } from '../ever-connect-identity.store';
import { EVER_CONNECT_CLOCK, EVER_CONNECT_ENV, IDENTITY_BATCH, ULID_SHAPE } from '../ever-connect.constants';
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

/**
 * A person's deletion and export requests from the event feed, and this installation's answers
 * (`POST /v1/instances/me/ack`).
 *
 * Each request is recorded by its event id before it is handled, so a request read twice (a replayed
 * page, two API processes) is answered once. The answer is sent at once; when Ever Platform cannot be
 * reached it is kept and sent again by the API process holding the connection's lease, with a
 * back-off of up to a day. Answers are not gated by any integration: a request already received stays
 * answerable after Sign in with Ever ID is switched off.
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
		const hashes = subjectHashes(data);
		if (!kind || typeof event.id !== 'string' || !ULID_SHAPE.test(event.id) || !ULID_SHAPE.test(jobId)) {
			return false;
		}
		const respondBy = Date.parse(String(data['respond_by'] ?? ''));
		const fresh = await this.identity.addRequest({
			id: event.id,
			kind,
			jobId,
			respondBy: Number.isFinite(respondBy) ? respondBy : null
		});
		let row = await this.identity.request(event.id);
		if (!row) {
			return false;
		}
		if (!fresh && row.result !== null) {
			// Read before: answered, or its answer waits to be sent again.
			return true;
		}
		const answer = await (kind === 'deletion' ? this.deletion : this.exports).answer(hashes, jobId);
		await this.identity.updateRequest(row.id, {
			result: answer.result,
			reasonCode: answer.reasonCode ?? null,
			legalBasis: answer.legalBasis ?? null,
			exportUrlEncrypted: answer.exportUrl ? this.secrets.seal(answer.exportUrl, 'integration_config') : null,
			state: 'pending',
			nextAttemptAt: this.now()
		});
		await this.audit.record({
			action: 'person_request.answer',
			actorLabel: 'system',
			details: { job_id: jobId, op: kind, result: answer.result, count: answer.accounts, ...(answer.reasonCode ? { reason: answer.reasonCode } : {}) }
		});
		row = await this.identity.request(row.id);
		if (row) {
			await this.send(row);
		}
		return true;
	}

	/** Sends the answers that are due again (by the API process holding the connection's lease). */
	async sendDue(): Promise<number> {
		let sent = 0;
		for (const row of await this.identity.dueRequests(this.now(), IDENTITY_BATCH)) {
			if (await this.send(row)) sent++;
		}
		return sent;
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
