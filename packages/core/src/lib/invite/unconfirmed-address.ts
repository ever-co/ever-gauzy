import { ForbiddenException } from '@nestjs/common';

/** What answering an invitation says to a caller whose address is not confirmed yet. */
export const UNCONFIRMED_ADDRESS_MESSAGE =
	'Confirm your email address first, then answer the invitation. You can also use the link in the invitation email.';

/**
 * `PUT /invite/:id/:action` (and the GraphQL `handleInvitationResponse`) finds the invitation by the caller's CURRENT
 * address, and a user can type any address into their own profile, where it is stored unconfirmed (see
 * `holdsProvenAddress`). Without a confirmed address, the caller could accept or reject an invitation sent to somebody
 * else: join its organization and teams, add another workspace's account to a team, or create an account in another
 * workspace for an address they do not hold. Refused before anything is read or written; the invitation stays open,
 * and its e-mailed link or code still works, since that proves the address.
 */
export class UnconfirmedAddressException extends ForbiddenException {
	constructor() {
		super(UNCONFIRMED_ADDRESS_MESSAGE);
	}
}
