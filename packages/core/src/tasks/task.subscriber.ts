import { EventSubscriber } from "typeorm";
import { RequestContext } from "./../core/context";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";
import { Task } from "./task.entity";

@EventSubscriber()
export class TaskSubscriber extends BaseEntityEventSubscriber<Task> {

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
     */
    async afterEntityLoad(entity: Task): Promise<void> {
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
            console.error('TaskSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }

    /**
     * Called before entity is inserted to the database.
     *
     * @param entity
     */
    async beforeEntityCreate(entity: Task): Promise<void> {
        try {
            if (entity) {
                entity.creatorId = RequestContext.currentUserId();
            }
        } catch (error) {
            console.error('TaskSubscriber: An error occurred during the beforeEntityCreate process:', error);
        }
    }
}
