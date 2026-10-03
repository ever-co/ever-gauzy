import { IEvent } from '@nestjs/cqrs';
import { IUser } from '@gauzy/contracts';

/**
 * Published after a user's e-mail address was changed to one that has not been confirmed yet.
 *
 * The confirmation state was reset in the same write; the handler sends the confirmation e-mail
 * for the new address (the same message registration sends). It lives in the auth module because
 * that is where the confirmation service is, and the user module cannot depend on it directly.
 */
export class UserEmailChangedEvent implements IEvent {
	constructor(public readonly user: IUser) {}
}
