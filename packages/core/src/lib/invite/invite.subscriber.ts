import { EventSubscriber } from 'typeorm';
import moment from 'moment';
import { InviteStatusEnum } from '@gauzy/contracts';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { Invite } from './invite.entity';

@EventSubscriber()
export class InviteSubscriber extends BaseEntityEventSubscriber<Invite> {
	/**
	 * Indicates that this subscriber only listen to Invite events.
	 */
	listenTo() {
		return Invite;
	}

	/**
	 * Called after an Invite entity is loaded from the database. This method updates the
	 * entity's status based on its expiration date.
	 *
	 * @param entity The Invite entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the post-load processing is complete.
	 */
	async afterEntityLoad(entity: Invite): Promise<void> {
		try {
			if (Object.prototype.hasOwnProperty.call(entity, 'expireDate')) {
				// Determine if the invite is expired
				entity.isExpired = entity.expireDate ? moment(entity.expireDate).isBefore(moment()) : false;
			}

			// Update the status based on the expiration
			entity.status = entity.isExpired ? InviteStatusEnum.EXPIRED : entity.status;
		} catch (error) {
			console.error('InviteSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}
}
