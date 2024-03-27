import { EventSubscriber } from 'typeorm';
import * as moment from 'moment';
import { environment } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { EmailReset } from './email-reset.entity';

@EventSubscriber()
export class EmailResetSubscriber extends BaseEntityEventSubscriber<EmailReset> {

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
     */
    async afterEntityLoad(entity: EmailReset): Promise<void> {
        try {
            if ('expiredAt' in entity) {
                entity.isExpired = entity.expiredAt ? moment(entity.expiredAt).isBefore(moment()) : false;
            }
        } catch (error) {
            console.error('EmailResetSubscriber: Error during the afterEntityLoad process:', error);
        }
    }

    /**
     * Called before entity is inserted/created to the database.
     *
     * @param entity
     */
    async beforeEntityCreate(entity: EmailReset): Promise<void> {
        try {
            if (entity) {
                entity.expiredAt = moment(new Date()).add(environment.EMAIL_RESET_EXPIRATION_TIME, 'seconds').toDate()
            }
        } catch (error) {
            console.error('EmailResetSubscriber: Error during the beforeEntityCreate process:', error);
        }
    }
}
