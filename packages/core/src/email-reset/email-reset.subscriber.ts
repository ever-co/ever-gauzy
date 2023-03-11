import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent } from 'typeorm';
import * as moment from 'moment';
import { environment } from '@gauzy/config';
import { EmailReset } from './email-reset.entity';

@EventSubscriber()
export class EmailResetSubscriber implements EntitySubscriberInterface<EmailReset> {
	/**
	 * Indicates that this subscriber only listen to EmailReset events.
	 */
	listenTo() {
		return EmailReset;
	}

	/**
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 * @param event
	 */
	afterLoad(entity: EmailReset, event?: LoadEvent<EmailReset>): void | Promise<any> {
		try {
			if ('expiredAt' in entity) {
				entity.isExpired = entity.expiredAt ? moment(entity.expiredAt).isBefore(moment()) : false;
			}
		} catch (error) {
			console.log(error);
		}
	}

	/**
	 * Called before entity is inserted to the database.
	 *
	 * @param event
	 */
	beforeInsert(event: InsertEvent<EmailReset>): void | Promise<any> {
		try {
			if (event.entity) {
				const entity = event.entity;
				entity.expiredAt = moment(new Date()).add(environment.EMAIL_RESET_EXPIRATION_TIME, 'seconds').toDate();
			}
		} catch (error) {
			console.log(error);
		}
	}
}
