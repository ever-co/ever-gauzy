import {
    EntitySubscriberInterface,
    EventSubscriber,
    InsertEvent,
    LoadEvent,
} from 'typeorm';
import { faker } from '@faker-js/faker';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from './../core/file-storage';
import { Tag } from './tag.entity';

@EventSubscriber()
export class TagSubscriber implements EntitySubscriberInterface<Tag> {
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
     * @param event
     */
    async afterLoad(
        entity: Tag | Partial<Tag>,
        event?: LoadEvent<Tag>
    ): Promise<any | void> {
        try {
            if (entity.icon) {
                const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
                entity.fullIconUrl = await store.getProviderInstance().url(entity.icon);
            }
        } catch (error) {
            console.error('Error in afterLoad:', error);
        }
    }

    /**
     * Called before entity is inserted to the database.
     *
     * @param event
     */
    beforeInsert(event: InsertEvent<Tag>) {
        try {
            if (event) {
                const { entity } = event;
                if (!entity.color) {
                    entity.color = faker.internet.color();
                }
            }
        } catch (error) {
            console.log('Error while creating tags', error);
        }
    }
}
