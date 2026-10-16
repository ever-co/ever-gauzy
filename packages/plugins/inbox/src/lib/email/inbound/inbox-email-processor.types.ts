import { ID } from '@gauzy/contracts';

/** DI token of the worker that processes received messages (`InboxEmailProcessor`). */
export const INBOX_EMAIL_PROCESSOR = 'INBOX_EMAIL_PROCESSOR';

/** The worker as the webhook sees it: hand over a stored message. */
export interface IInboxEmailProcessor {
	/** Processes the message soon, off the request (a duplicate hand-over while it runs is ignored). */
	enqueue(emailId: ID): void;
}
