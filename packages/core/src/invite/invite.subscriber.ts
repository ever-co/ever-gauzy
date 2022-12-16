import { EntitySubscriberInterface, EventSubscriber } from "typeorm";
import { InviteStatusEnum } from "@gauzy/contracts";
import * as moment from 'moment';
import { Invite } from "./invite.entity";

@EventSubscriber()
export class InviteSubscriber implements EntitySubscriberInterface<Invite> {

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
    afterLoad(entity: Invite) {
        try {
            if ('expireDate' in entity) {
                entity.isExpired = entity.expireDate ? moment(entity.expireDate).isBefore(moment()) : false;
            }
            if ('status' in entity) {
                entity.status = entity.isExpired ? InviteStatusEnum.EXPIRED : entity.status;
            }
        } catch (error) {
            console.log(error);
        }
    }
}