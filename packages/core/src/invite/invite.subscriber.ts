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
    * Called after entity is loaded.
    */
    afterLoad(entity: Invite) {
        entity.isExpired = entity.expireDate ? moment(entity.expireDate).isBefore(moment()) : false;
        entity.status = entity.isExpired ? InviteStatusEnum.EXPIRED : entity.status;
    }
}