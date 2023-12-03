import { gauzyToggleFeatures } from "@gauzy/config";
import { FeatureStatusEnum, FileStorageProviderEnum } from "@gauzy/contracts";
import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from "typeorm";
import { shuffle } from 'underscore';
import { FileStorage } from "./../core/file-storage";
import { Feature } from "./feature.entity";

@EventSubscriber()
export class FeatureSubscriber implements EntitySubscriberInterface<Feature> {

    /**
    * Indicates that this subscriber only listen to Feature events.
    */
    listenTo() {
        return Feature;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     */
    async afterLoad(
        entity: Feature,
        event?: LoadEvent<Feature>
    ): Promise<any | void> {
        try {
            if (!entity.status) {
                entity.status = shuffle(Object.values(FeatureStatusEnum))[0];
            }

            if (gauzyToggleFeatures.hasOwnProperty(entity.code)) {
                entity.isEnabled = !!gauzyToggleFeatures[entity.code];
            } else {
                entity.isEnabled = true;
            }

            if (entity.image) {
                const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
                entity.imageUrl = await store.getProviderInstance().url(entity.image);
            }
        } catch (error) {
            console.error('Error in afterLoad:', error);
        }
    }
}
