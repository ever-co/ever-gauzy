import { EventSubscriber } from 'typeorm';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { EmailTemplate } from './email-template.entity';

@EventSubscriber()
export class EmailTemplateSubscriber extends BaseEntityEventSubscriber<EmailTemplate> {
	/**
	 * Indicates that this subscriber only listen to EmailTemplate events.
	 */
	listenTo() {
		return EmailTemplate;
	}

	/**
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 */
	async afterEntityLoad(entity: EmailTemplate): Promise<void> {
		try {
			if ('name' in entity) {
				entity.title = entity.name?.split('/')[0].split('-').join(' ');
			}
		} catch (error) {
			console.error('EmailTemplateSubscriber: Error during the afterEntityLoad process:', error);
		}
	}
}
