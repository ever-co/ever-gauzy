import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from "typeorm";
import { FileStorage } from "./../core/file-storage";
import { ImageAsset } from "./image-asset.entity";

@EventSubscriber()
export class ImageAssetSubscriber implements EntitySubscriberInterface<ImageAsset> {

    /**
    * Indicates that this subscriber only listen to ImageAsset events.
    */
    listenTo() {
        return ImageAsset;
    }

    /**
    * Called after entity is loaded from the database.
    *
    * @param entity
    * @param event
    */
    async afterLoad(entity: ImageAsset, event?: LoadEvent<ImageAsset>): Promise<any | void> {
        try {
            if (entity instanceof ImageAsset) {
                const { storageProvider, url, thumb } = entity;
                const store = new FileStorage().setProvider(storageProvider).getProviderInstance();
                entity.fullUrl = await store.url(url);
                entity.thumbUrl = await store.url(thumb);
                console.log(entity, 'Image Asset Subscriber');
            }
        } catch (error) {
            console.error('Error in afterLoad:', error);
        }
    }
}
