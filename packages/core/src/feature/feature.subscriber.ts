import { EventSubscriber } from "typeorm";
import { shuffle } from 'underscore';
import { gauzyToggleFeatures } from "@gauzy/config";
import { FeatureStatusEnum, FileStorageProviderEnum } from "@gauzy/contracts";
import { FileStorage } from "./../core/file-storage";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";
import { Feature } from "./feature.entity";

@EventSubscriber()
export class FeatureSubscriber extends BaseEntityEventSubscriber<Feature> {

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
     */
    async afterEntityLoad(entity: Feature): Promise<void> {
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
            console.error('FeatureSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }
}
