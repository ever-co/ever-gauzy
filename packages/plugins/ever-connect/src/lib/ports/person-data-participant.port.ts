/**
 * The Gauzy accounts a person's request is about: the users linked to the person's Ever ID on this
 * installation, and Ever Platform's job id of the request (for the participant's own records).
 */
export interface PersonDataSubject {
	userIds: string[];
	jobId: string;
}

/** What the participant did for a deletion request. */
export type PersonDeletionOutcome =
	| { result: 'deleted' | 'anonymised' }
	/** Kept under a legal obligation, named by `legalBasis` (a statute or a contract clause, 1 to 200 characters, never personal data). */
	| { result: 'retained_legal'; legalBasis: string };

/** What the participant did for an export request: the `https` link to the export it prepared. */
export interface PersonExportOutcome {
	result: 'exported';
	exportUrl: string;
}

/**
 * The participant that deletes, anonymises or exports the personal data of Gauzy accounts when a
 * person asks Ever Platform to (the account-deletion and export features bind it).
 *
 * Until one is bound, this plugin still removes the Ever ID links of the person, and answers each
 * request honestly: `failed` with `account_deletion_pending` (deletion) or `export_not_available`
 * (export), which keeps the request open on Ever Platform for a later answer.
 */
export interface PersonDataParticipantPort {
	deletePersonData(subject: PersonDataSubject): Promise<PersonDeletionOutcome>;
	exportPersonData(subject: PersonDataSubject): Promise<PersonExportOutcome>;
}
