import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from 'typeorm';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from './../core/file-storage';
import { Integration } from './integration.entity';

@EventSubscriber()
export class IntegrationSubscriber implements EntitySubscriberInterface<Integration> {
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
     * @param event
     */
    async afterLoad(
        entity: Integration | Partial<Integration>,
        event?: LoadEvent<Integration>
    ): Promise<any | void> {
        try {
            if (!!entity.imgSrc) {
                const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
                entity.fullImgUrl = await store.getProviderInstance().url(entity.imgSrc);
            }
        } catch (error) {
            console.error('Error in afterLoad:', error);
        }
    }
}
