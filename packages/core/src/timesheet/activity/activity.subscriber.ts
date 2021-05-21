import { EntitySubscriberInterface, EventSubscriber } from "typeorm";
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
    * Called after entity is loaded.
    */
    afterLoad(entity: Activity) {
        if (typeof entity.metaData === 'string') {
			try {
				entity.metaData = JSON.parse(entity.metaData);
			} catch (error) {
				entity.metaData = {};
			}
		}
    }
}