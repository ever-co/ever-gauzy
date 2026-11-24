import { ConflictException } from '@nestjs/common';

/** What an acceptance answers when the invited address already has an account and the request is not its session. */
export const EXISTING_ACCOUNT_SIGN_IN_REQUIRED_MESSAGE =
	'This email already has an account. Sign in to it, then accept the invitation from there.';

/**
 * The token and the code of an invitation are known to whoever sent it, so they prove nothing about an account that
 * already exists: such an account accepts from its own signed-in session, and any other acceptance is refused before
 * anything is written.
 */
export class ExistingAccountSignInRequiredException extends ConflictException {
	constructor() {
		super(EXISTING_ACCOUNT_SIGN_IN_REQUIRED_MESSAGE);
	}
}
