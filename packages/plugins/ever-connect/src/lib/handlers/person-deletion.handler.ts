import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EVER_ID_ACCOUNTS, EverIdAccountsPort } from '@gauzy/plugin-auth-zitadel';
import { EVER_PERSON_DATA_PARTICIPANT } from '../ever-connect.constants';
import { errorCode } from '../ever-connect-platform.service';
import { PersonDataParticipantPort } from '../ports/person-data-participant.port';

/** This installation's answer to a person's request, as `POST /v1/instances/me/ack` carries it. */
export interface PersonRequestAnswer {
	result: 'deleted' | 'anonymised' | 'retained_legal' | 'no_account' | 'exported' | 'failed';
	/** For `failed`: why, a machine token. */
	reasonCode?: string;
	/** For `retained_legal`: the legal obligation the data is kept under. */
	legalBasis?: string;
	/** For `exported`: the `https` link to this installation's own export. */
	exportUrl?: string;
	/** How many Gauzy accounts the request named (for the audit). */
	accounts: number;
}

/** A reason code as the contract takes it. */
const REASON = /^[a-z_]{1,64}$/;

/**
 * A person's deletion request (`ever.registry.person.deletion_requested`): the Ever ID links of the
 * named identities are removed, and the Gauzy sessions opened through them end (by the Ever ID
 * sign-in plugin, {@link EverIdAccountsPort.erase}); then the personal-data participant deletes or
 * anonymises the accounts. Without a participant the answer is `failed` with
 * `account_deletion_pending`: the links are gone, but the accounts still hold the person's data, so
 * the request stays open on Ever Platform. No linked account: `no_account`.
 */
@Injectable()
export class PersonDeletionHandler {
	private readonly logger = new Logger('EverConnect');

	constructor(
		@Optional() @Inject(EVER_ID_ACCOUNTS) private readonly accounts?: EverIdAccountsPort,
		@Optional() @Inject(EVER_PERSON_DATA_PARTICIPANT) private readonly participant?: PersonDataParticipantPort
	) {}

	async answer(subjectHashes: string[], jobId: string): Promise<PersonRequestAnswer> {
		if (!this.accounts) {
			// The Ever ID sign-in plugin is not loaded: its links cannot be looked up here.
			return { result: 'failed', reasonCode: 'account_deletion_pending', accounts: 0 };
		}
		const userIds = await this.accounts.erase(subjectHashes);
		if (!userIds.length) {
			return { result: 'no_account', accounts: 0 };
		}
		if (!this.participant) {
			return { result: 'failed', reasonCode: 'account_deletion_pending', accounts: userIds.length };
		}
		try {
			const outcome = await this.participant.deletePersonData({ userIds, jobId });
			if (outcome.result === 'retained_legal') {
				const legalBasis = typeof outcome.legalBasis === 'string' ? outcome.legalBasis.trim() : '';
				if (!legalBasis || legalBasis.length > 200) {
					return { result: 'failed', reasonCode: 'legal_basis_missing', accounts: userIds.length };
				}
				return { result: 'retained_legal', legalBasis, accounts: userIds.length };
			}
			if (outcome.result === 'deleted' || outcome.result === 'anonymised') {
				return { result: outcome.result, accounts: userIds.length };
			}
			return { result: 'failed', reasonCode: 'participant_error', accounts: userIds.length };
		} catch (error) {
			this.logger.warn(`A person's data could not be deleted here (${errorCode(error)}).`);
			const code = error instanceof Error && 'reasonCode' in error ? String((error as { reasonCode: unknown }).reasonCode) : '';
			return { result: 'failed', reasonCode: REASON.test(code) ? code : 'participant_error', accounts: userIds.length };
		}
	}
}
