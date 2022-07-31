import { isJsObject } from "@gauzy/common";
import { getConfig } from "@gauzy/config";
import {
    DataSourceOptions,
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

    beforeInsert(event: InsertEvent<Activity>): void | Promise<any> {
        if (event) {
            const options: Partial<DataSourceOptions> = event.connection.options || getConfig().dbConnectionOptions;
            if (options.type === 'sqlite') {
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
    }
}