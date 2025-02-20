import { EventSubscriber } from 'typeorm';
import { RequestContext } from './../core/context';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { Payment } from './payment.entity';

@EventSubscriber()
export class PaymentSubscriber extends BaseEntityEventSubscriber<Payment> {
	/**
	 * Indicates that this subscriber only listen to Payment events.
	 */
	listenTo() {
		return Payment;
	}

	/**
	 * Called before a Payment entity is inserted or created in the database. This method assigns
	 * the ID of the current user to the recordedById property of the entity, tracking who created the payment.
	 *
	 * @param entity The Payment entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: Payment): Promise<void> {
		try {
			// Assign the current user's ID to recordedById
			entity.createdByUserId = RequestContext.currentUserId();
		} catch (error) {
			console.error('Error in PaymentSubscriber beforeEntityCreate:', error.message);
		}
	}
}
