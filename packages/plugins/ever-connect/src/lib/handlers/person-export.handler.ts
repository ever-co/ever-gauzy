import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EVER_ID_ACCOUNTS, EverIdAccountsPort } from '@gauzy/plugin-auth-zitadel';
import { EVER_PERSON_DATA_PARTICIPANT } from '../ever-connect.constants';
import { errorCode } from '../ever-connect-platform.service';
import { PersonDataParticipantPort } from '../ports/person-data-participant.port';
import { PersonRequestAnswer, PersonRequestSubject } from './person-deletion.handler';

/** The longest export link Ever Platform takes. */
const MAX_EXPORT_URL = 2048;

/** Whether `value` is an `https` link without credentials, as an export link must be. */
export function usableExportUrl(value: unknown): value is string {
	if (typeof value !== 'string' || value.length > MAX_EXPORT_URL) {
		return false;
	}
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
	} catch {
		return false;
	}
}

/**
 * A person's export request (`ever.registry.person.export_requested`): the personal-data participant
 * prepares an export of the accounts linked to the named identities and answers with its `https`
 * link (`exported`), which Ever Platform stores and links for the person, never fetching it. Without
 * a participant: `failed` with `export_not_available`. No linked account: `no_account`. Nothing is
 * removed.
 */
@Injectable()
export class PersonExportHandler {
	private readonly logger = new Logger('EverConnect');

	constructor(
		@Optional() @Inject(EVER_ID_ACCOUNTS) private readonly accounts?: EverIdAccountsPort,
		@Optional() @Inject(EVER_PERSON_DATA_PARTICIPANT) private readonly participant?: PersonDataParticipantPort
	) {}

	async answer(subject: PersonRequestSubject): Promise<PersonRequestAnswer> {
		if (!this.accounts) {
			return { result: 'failed', reasonCode: 'export_not_available', accounts: 0 };
		}
		const { userIds } = subject;
		if (!userIds.length) {
			return { result: 'no_account', accounts: 0 };
		}
		if (!this.participant) {
			return { result: 'failed', reasonCode: 'export_not_available', accounts: userIds.length };
		}
		try {
			const outcome = await this.participant.exportPersonData({ userIds, jobId: subject.jobId });
			if (outcome?.result === 'exported' && usableExportUrl(outcome.exportUrl)) {
				return { result: 'exported', exportUrl: outcome.exportUrl, accounts: userIds.length };
			}
			return { result: 'failed', reasonCode: 'export_not_available', accounts: userIds.length };
		} catch (error) {
			this.logger.warn(`A person's data could not be exported here (${errorCode(error)}).`);
			return { result: 'failed', reasonCode: 'export_not_available', accounts: userIds.length };
		}
	}
}
