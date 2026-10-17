// cspell:ignore DMARC
import { ID } from '@gauzy/contracts';

/** DI token of the worker that processes received messages (`InboxEmailProcessor`). */
export const INBOX_EMAIL_PROCESSOR = 'INBOX_EMAIL_PROCESSOR';

/**
 * The stored header that holds a message in the quarantine whatever its spam verdict (set by the webhook, never taken
 * from the message: `x-gauzy-*` headers are not kept from a delivery), with the reason as its value.
 */
export const INBOX_HOLD_HEADER = 'x-gauzy-inbox-hold';
/** The hold of a mailbox with an allowlist: the sender is on it, but no DMARC pass proves the From domain. */
export const HOLD_UNVERIFIED_SENDER = 'unverified-sender';

/** The worker as the webhook sees it: hand over a stored message. */
export interface IInboxEmailProcessor {
	/** Processes the message soon, off the request (a duplicate hand-over while it runs is ignored). */
	enqueue(emailId: ID): void;
}
