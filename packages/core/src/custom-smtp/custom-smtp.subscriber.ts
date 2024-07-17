import { EventSubscriber } from 'typeorm';
import { WrapSecrets } from './../core/decorators';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { CustomSmtp } from './custom-smtp.entity';

@EventSubscriber()
export class CustomSmtpSubscriber extends BaseEntityEventSubscriber<CustomSmtp> {
	/**
	 * Indicates that this subscriber only listen to CustomSmtp events.
	 */
	listenTo() {
		return CustomSmtp;
	}

	/**
	 * Processes a CustomSmtp entity after it's loaded.
	 * This function sets the entity's secretKey and secretPassword based on its username and password, if they are present.
	 *
	 * @param entity The CustomSmtp entity that has been loaded.
	 */
	async afterEntityLoad(entity: CustomSmtp): Promise<void> {
		try {
			if ('username' in entity) {
				entity.secretKey = entity.username;
			}
			if ('password' in entity) {
				entity.secretPassword = entity.password;
			}
			WrapSecrets(entity, entity); // Assuming wrapSecrets is a function to securely handle secrets.
		} catch (error) {
			console.error('CustomSmtpSubscriber: Error during the afterEntityLoad process:', error);
		}
	}
}
