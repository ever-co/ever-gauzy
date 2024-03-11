import { EventSubscriber } from "typeorm";
import { isJsObject } from "@gauzy/common";
import { isBetterSqlite3, isSqlite } from "@gauzy/config";
import { BaseEntityEventSubscriber } from "../../core/entities/subscribers/base-entity-event.subscriber";
import { Activity } from "./activity.entity";

@EventSubscriber()
export class ActivitySubscriber extends BaseEntityEventSubscriber<Activity> {

    /**
    * Indicates that this subscriber only listen to Activity events.
    */
    listenTo() {
        return Activity;
    }

    /**
     * Called before activity entity is inserted / created to the database.
     *
     * @param entity
     */
    async beforeEntityCreate(entity: Activity): Promise<void> {
        try {
            if (entity) {
                if (isSqlite() || isBetterSqlite3()) {
                    try {
                        if (isJsObject(entity.metaData)) {
                            entity.metaData = JSON.stringify(entity.metaData);
                        }
                    } catch (error) {
                        entity.metaData = JSON.stringify({});
                        console.log('Before Insert Activity Error:', error);
                    }
                }
            }
        } catch (error) {
            console.error('ActivitySubscriber: An error occurred during the beforeEntityCreate process:', error);
        }
    }
}
