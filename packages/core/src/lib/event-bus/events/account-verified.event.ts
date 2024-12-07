import { RequestContext } from '../../core/context';
import { User } from '../../core/entities/internal';
import { BaseEvent } from '../base-event';

/**
 * Event class representing an account verification event.
 */
export class AccountVerifiedEvent extends BaseEvent {
	/**
	 * Constructor for AccountVerifiedEvent.
	 * @param ctx - The request context associated with the verification event.
	 * @param user - The user associated with the verification event.
	 */
	constructor(public readonly ctx: RequestContext, public readonly user: User) {
		super();
	}
}
