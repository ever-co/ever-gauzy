import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from "typeorm";
import * as moment from 'moment';
import { OrganizationTeamJoinRequest } from "./organization-team-join-request.entity";

@EventSubscriber()
export class OrganizationTeamJoinRequestSubscriber implements EntitySubscriberInterface<OrganizationTeamJoinRequest> {

    /**
    * Indicates that this subscriber only listen to OrganizationTeamJoinRequest events.
    */
    listenTo() {
        return OrganizationTeamJoinRequest;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    afterLoad(entity: OrganizationTeamJoinRequest, event?: LoadEvent<OrganizationTeamJoinRequest>): void | Promise<any> {
        try {
            if ('expireAt' in entity) {
                entity.isExpired = entity.expireAt ? moment(entity.expireAt).isBefore(moment()) : false;
            }
        } catch (error) {
            console.log(error);
        }
    }
}
