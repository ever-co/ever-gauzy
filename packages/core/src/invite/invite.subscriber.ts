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
     * Called after entity is loaded from the database.
     *
     * @param entity
     */
    async afterEntityLoad(entity: Invite): Promise<void> {
        try {
            if ('expireDate' in entity) {
                entity.isExpired = entity.expireDate ? moment(entity.expireDate).isBefore(moment()) : false;
            }
            if ('status' in entity) {
                entity.status = entity.isExpired ? InviteStatusEnum.EXPIRED : entity.status;
            }
        } catch (error) {
            console.error('InviteSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }
}
