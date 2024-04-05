import { EventSubscriber } from "typeorm";
import * as moment from 'moment';
import { InviteStatusEnum } from "@gauzy/contracts";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";
import { Invite } from "./invite.entity";

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
            if ('expireDate' in entity) {
                // Determine if the invite is expired
                entity.isExpired = entity.expireDate ? moment(entity.expireDate).isBefore(moment()) : false;
            }

            // Update the status based on the expiration
            if (entity.isExpired) {
                entity.status = InviteStatusEnum.EXPIRED;
            }
        } catch (error) {
            console.error('InviteSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }
}
