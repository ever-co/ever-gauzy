import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from './../core/file-storage';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { Tag } from './tag.entity';

@EventSubscriber()
export class TagSubscriber extends BaseEntityEventSubscriber<Tag> {

    /**
     * Indicates that this subscriber only listen to Tag events.
     */
    listenTo() {
        return Tag;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     */
    async afterEntityLoad(entity: Tag): Promise<void> {
        try {
            if (entity.icon) {
                const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
                entity.fullIconUrl = await store.getProviderInstance().url(entity.icon);
            }
        } catch (error) {
            console.error('TagSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }

    /**
     * Called before entity is inserted to the database.
     *
     * @param entity
     */
    async beforeEntityCreate(entity: Tag): Promise<void> {
        try {
            if (entity) {
                if (!entity.color) {
                    entity.color = faker.internet.color();
                }
            }
        } catch (error) {
            console.error('TagSubscriber: An error occurred during the beforeEntityCreate process:', error);
        }
    }
}
