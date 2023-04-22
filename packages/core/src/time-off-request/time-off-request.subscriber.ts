import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from "typeorm";
import { TimeOffRequest } from "./time-off-request.entity";

@EventSubscriber()
export class TimeOffRequestSubscriber implements EntitySubscriberInterface<TimeOffRequest> {

    /**
    * Indicates that this subscriber only listen to TimeOffRequest events.
    */
    listenTo() {
        return TimeOffRequest;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    afterLoad(entity: TimeOffRequest, event?: LoadEvent<TimeOffRequest>): void | Promise<any> {
        try {
            if (!!entity['document']) {
                entity.documentUrl = entity.document.fullUrl || entity.documentUrl;
            }
        } catch (error) {
            console.log(error);
        }
    }
}
