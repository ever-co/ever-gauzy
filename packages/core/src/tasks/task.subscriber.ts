import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from "typeorm";
import { Task } from "./task.entity";

@EventSubscriber()
export class TaskSubscriber implements EntitySubscriberInterface<Task> {

    /**
    * Indicates that this subscriber only listen to Task events.
    */
    listenTo() {
        return Task;
    }

    /**
    * Called after entity is loaded.
    */
    afterLoad(entity: Task) {
        if (entity) {
            const list = new Array();
            if (entity.prefix) {
                list.push(entity.prefix.toUpperCase());
            } else if (!entity.prefix && entity.project) {
                const prefix = entity.project.name;
                list.push(prefix.substring(0, 3).toUpperCase());
            }
            list.push(entity.number || 0);
            entity.taskNumber = list.join('-');
        }
    }

    /**
     * Called before task insertion.
     */
    beforeInsert(event: InsertEvent<Task>) {
        if (event) {
            const { entity } = event;
            console.log({ entity });
        }
    }
}