import { isJsObject, IDBConnectionOptions } from "@gauzy/common";
import { getConfig } from "@gauzy/config";
import {
    DataSourceOptions,
    EntitySubscriberInterface,
    EventSubscriber,
    InsertEvent
} from "typeorm";
import { Activity } from "./activity.entity";
import { isSqliteDB } from "core";

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
                const options: Partial<IDBConnectionOptions> = event.connection.options || getConfig().dbConnectionOptions;
                if (isSqliteDB(options)) {
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
