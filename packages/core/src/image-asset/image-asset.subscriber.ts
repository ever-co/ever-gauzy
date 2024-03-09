import { EventSubscriber } from "typeorm";
import { FileStorage } from "./../core/file-storage";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";
import { ImageAsset } from "./image-asset.entity";

@EventSubscriber()
export class ImageAssetSubscriber extends BaseEntityEventSubscriber<ImageAsset> {

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
     */
    async afterEntityLoad(entity: ImageAsset): Promise<void> {
        try {
            if (entity instanceof ImageAsset) {
                const { storageProvider, url, thumb } = entity;
                const store = new FileStorage().setProvider(storageProvider).getProviderInstance();
                entity.fullUrl = await store.url(url);
                entity.thumbUrl = await store.url(thumb);
            }
        } catch (error) {
            console.error('Error in ImageAssetSubscriber afterLoad:', error);
        }
    }
}
