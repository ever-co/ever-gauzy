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
    afterLoad(
        entity: Integration | Partial<Integration>,
        event?: LoadEvent<Integration>
    ): void | Promise<any> {
        try {
            if (!!entity.imgSrc) {
                const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
                entity.fullImgUrl = store.getProviderInstance().url(entity.imgSrc);
            }
        } catch (error) {
            console.log(error);
        }
    }
}
