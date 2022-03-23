import { isJsObject } from "@gauzy/common";
import { getConfig } from "@gauzy/config";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import {
    ConnectionOptions,
    EntitySubscriberInterface,
    EventSubscriber,
    getConnection,
    InsertEvent
} from "typeorm";
import { Activity } from "./activity.entity";

let options: ConnectionOptions | TypeOrmModuleOptions;
try {
	options = getConnection().options;
} catch (error) {
	options = getConfig().dbConnectionOptions
}

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
            const { entity } = event;
            if (options.type === 'sqlite') {
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