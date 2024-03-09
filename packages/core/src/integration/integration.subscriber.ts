import { EventSubscriber } from 'typeorm';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from './../core/file-storage';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { Integration } from './integration.entity';

@EventSubscriber()
export class IntegrationSubscriber extends BaseEntityEventSubscriber<Integration> {
    /**
     * Indicates that this subscriber only listen to Integration events.
     */
    listenTo() {
        return Integration;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     */
    async afterEntityLoad(entity: Integration): Promise<void> {
        try {
            if (!!entity.imgSrc) {
                const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
                entity.fullImgUrl = await store.getProviderInstance().url(entity.imgSrc);
            }
        } catch (error) {
            console.error('IntegrationSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }
}
