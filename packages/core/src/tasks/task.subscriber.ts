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
     * Called after a Task entity is loaded from the database. This method constructs a formatted
     * task number based on the prefix and the task's number.
     *
     * @param entity The Task entity that has been loaded.
     * @returns {Promise<void>} A promise that resolves when the task number generation is complete.
     */
    async afterEntityLoad(entity: Task): Promise<void> {
        try {
            if (entity) {
                let prefix = '';
                if (entity.prefix) {
                    // Use the entity's prefix in uppercase
                    prefix = entity.prefix.toUpperCase();
                } else if (entity.project?.name) {
                    // Use the first three characters of the project's name in uppercase
                    prefix = entity.project?.name.substring(0, 3).toUpperCase();
                }

                // Construct an array to hold the parts of the task number
                const list = [];
                // Add the prefix or derived prefix from the project name
                list.push(prefix);
                // Add the task number or default to 0
                list.push(entity.number || 0);

                // Set the taskNumber property if 'number' exists in the entity
                if ('number' in entity) {
                    entity.taskNumber = list.filter(Boolean).join('-');
                }
            }
        } catch (error) {
            console.error('TaskSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }

    /**
     * Called before a Task entity is inserted into the database. This method sets the creator ID
     * of the task based on the current user context.
     *
     * @param entity The Task entity about to be created.
     * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
     */
    async beforeEntityCreate(entity: Task): Promise<void> {
        try {
            // Retrieve the current user's ID from RequestContext and assign it as the creator
            if (entity) {
                entity.creatorId = RequestContext.currentUserId();
            }
        } catch (error) {
            console.error('TaskSubscriber: An error occurred during the beforeEntityCreate process:', error);
        }
    }
}
