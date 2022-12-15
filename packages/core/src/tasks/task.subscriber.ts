import { RequestContext } from "./../core/context";
import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent } from "typeorm";
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
     * Called after entity is loaded from the database.
     *
     * @param entity
     * @param event
     */
    afterLoad(entity: Task, event?: LoadEvent<Task>): void | Promise<any> {
        try {
            if (entity) {
                const list = new Array();
                if (entity.prefix) {
                    list.push(entity.prefix.toUpperCase());
                } else if (!entity.prefix && entity.project) {
                    if (entity.project.name) {
                        const prefix = entity.project.name;
                        list.push(prefix.substring(0, 3).toUpperCase());
                    }
                }
                list.push(entity.number || 0);
                if ('number' in entity) {
                    entity.taskNumber = list.join('-');
                }
            }
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Called before entity is inserted to the database.
     *
     * @param event
     */
    beforeInsert(event: InsertEvent<Task>): void | Promise<any> {
        try {
            if (event) {
                const { entity } = event;
                entity.creatorId = RequestContext.currentUserId();
            }
        } catch (error) {
            console.log(error);
        }
    }
}