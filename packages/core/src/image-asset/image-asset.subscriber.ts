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
    afterLoad(entity: ImageAsset | Partial<ImageAsset>, event?: LoadEvent<ImageAsset>): void | Promise<any> {
        try {
            if (entity instanceof ImageAsset) {
                const { storageProvider } = entity;
                const store = new FileStorage().setProvider(storageProvider);
                entity.fullUrl = store.getProviderInstance().url(entity.url);
                entity.thumbUrl = store.getProviderInstance().url(entity.thumb);
            }
        } catch (error) {
            console.log(error);
        }
    }
}
