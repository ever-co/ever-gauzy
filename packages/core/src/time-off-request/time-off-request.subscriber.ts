import { EventSubscriber } from "typeorm";
import { TimeOffRequest } from "./time-off-request.entity";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";

@EventSubscriber()
export class TimeOffRequestSubscriber extends BaseEntityEventSubscriber<TimeOffRequest> {

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
     */
    async afterEntityLoad(entity: TimeOffRequest): Promise<void> {
        try {
            if (!!entity['document']) {
                entity.documentUrl = entity.document.fullUrl || entity.documentUrl;
            }
        } catch (error) {
            console.error('ActivitySubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }
}
