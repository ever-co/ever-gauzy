import { gauzyToggleFeatures } from "@gauzy/config";
import { FeatureStatusEnum } from "@gauzy/contracts";
import { EntitySubscriberInterface, EventSubscriber } from "typeorm";
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
    * Called after entity is loaded.
    */
    afterLoad(entity: any) {
        if (!entity.status) {
			entity.status = shuffle(Object.values(FeatureStatusEnum))[0];
		}

        if (gauzyToggleFeatures.hasOwnProperty(entity.code)) {
			const feature = gauzyToggleFeatures[entity.code];
			entity.isEnabled = feature;
		} else {
			entity.isEnabled = true;
		}

        if (entity.image) {
			entity.imageUrl = new FileStorage().getProvider().url(entity.image);
		}
    }
}