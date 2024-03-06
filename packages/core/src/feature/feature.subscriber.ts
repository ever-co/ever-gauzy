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
     * Called after an entity is loaded from the database.
     *
     * @param entity - The loaded Feature entity.
     * @param event - The LoadEvent associated with the entity loading.
     */
    async afterLoad(entity: Feature, event?: LoadEvent<Feature>): Promise<void> {
        try {
            // Set a default status if not present
            if (!entity.status) {
                entity.status = shuffle(Object.values(FeatureStatusEnum))[0];
            }

            // Check and set isEnabled based on gauzyToggleFeatures
            entity.isEnabled = gauzyToggleFeatures.hasOwnProperty(entity.code) ? !!gauzyToggleFeatures[entity.code] : true;

            // Set imageUrl based on the entity's image property
            if (entity.image) {
                const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
                entity.imageUrl = await store.getProviderInstance().url(entity.image);
            }
        } catch (error) {
            console.error('Error in afterLoad:', error);
        }
    }
}
