import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent } from "typeorm";
import { getUserDummyImage } from "./../core/utils";
import { User } from "./user.entity";

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {

    /**
    * Indicates that this subscriber only listen to User events.
    */
    listenTo() {
        return User;
    }

    /**
     * Called before the entity is inserted into the database.
     *
     * @param event - The insert event.
     */
    async beforeInsert(event: InsertEvent<User>): Promise<void> {
        try {
            const entity = event.entity;

            // Set a default imageUrl using a dummy image if not provided
            entity.imageUrl = entity.imageUrl || getUserDummyImage(entity);
        } catch (error) {
            console.error('Error in UserSubscriber beforeInsert hook:', error);
        }
    }

    /**
     * Called after the entity is loaded from the database.
     *
     * @param entity - The loaded entity.
     * @param event - The load event.
     */
    async afterLoad(entity: User, event?: LoadEvent<User>): Promise<void> {
        try {
            // Combine first name and last name into a single "name" property
            entity.name = [entity.firstName, entity.lastName].filter(Boolean).join(' ');

            // Set employeeId based on the existence of the "employee" property
            entity.employeeId = entity.employee?.id || null;

            // Set isEmailVerified based on the existence of "emailVerifiedAt" property
            if ('emailVerifiedAt' in entity) {
                entity.isEmailVerified = !!entity.emailVerifiedAt;
            }

            // Set imageUrl based on the existence of the "image" property
            if (entity['image']) {
                // Fall back to the existing imageUrl property if fullUrl is not available
                entity.imageUrl = entity['image'].fullUrl || entity.imageUrl;
                console.log(entity['image'], 'User Subscriber');
            }
        } catch (error) {
            console.error('Error in UserSubscriber afterLoad hook:', error);
        }
    }
}
