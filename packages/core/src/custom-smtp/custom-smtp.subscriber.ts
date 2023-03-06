import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from 'typeorm';
import { WrapSecrets } from './../core/decorators';
import { CustomSmtp } from './custom-smtp.entity';

@EventSubscriber()
export class CustomSmtpSubscriber implements EntitySubscriberInterface<CustomSmtp> {
	/**
	 * Indicates that this subscriber only listen to CustomSmtp events.
	 */
	listenTo() {
		return CustomSmtp;
	}

	/**
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 * @param event
	 */
	afterLoad(entity: CustomSmtp, event?: LoadEvent<CustomSmtp>): void | Promise<any> {
		entity.secretKey = entity.username;
		entity.secretPassword = entity.password;
		WrapSecrets(entity, entity);
	}
}
