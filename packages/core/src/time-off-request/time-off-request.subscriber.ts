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
     * Called after a TimeOffRequest entity is loaded from the database. This method updates
     * the entity's document URL if an associated document with a full URL is present.
     *
     * @param entity The TimeOffRequest entity that has been loaded.
     * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
     */
    async afterEntityLoad(entity: TimeOffRequest): Promise<void> {
        try {
            // Check if the entity has an associated document with a full URL and update the document URL
            if (entity.document && entity.document.fullUrl) {
                entity.documentUrl = entity.document.fullUrl;
            }
        } catch (error) {
            console.error('TimeOffRequestSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }
}
