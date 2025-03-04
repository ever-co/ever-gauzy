import { EventSubscriber } from 'typeorm';
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
}
