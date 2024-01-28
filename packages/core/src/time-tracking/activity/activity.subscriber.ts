import { isJsObject } from "@gauzy/common";
import { isBetterSqlite3, isSqlite } from "@gauzy/config";
import {
    EntitySubscriberInterface,
    EventSubscriber,
    InsertEvent
} from "typeorm";
import { Activity } from "./activity.entity";

@EventSubscriber()
export class ActivitySubscriber implements EntitySubscriberInterface<Activity> {

    /**
    * Indicates that this subscriber only listen to Activity events.
    */
    listenTo() {
        return Activity;
    }

    /**
     * Called before activity entity is inserted to the database.
     *
     * @param event
     */
    beforeInsert(event: InsertEvent<Activity>): void | Promise<any> {
        try {
            if (event) {
                if (isSqlite() || isBetterSqlite3()) {
                    const { entity } = event;
                    try {
                        if (isJsObject(entity.metaData)) {
                            entity.metaData = JSON.stringify(entity.metaData);
                        }
                    } catch (error) {
                        console.log('Before Insert Activity Error:', error);
                        entity.metaData = JSON.stringify({});
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    }
}
