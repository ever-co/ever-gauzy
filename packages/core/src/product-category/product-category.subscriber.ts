import { EventSubscriber } from "typeorm";
import { ProductCategory } from "./product-category.entity";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";

@EventSubscriber()
export class ProductCategorySubscriber extends BaseEntityEventSubscriber<ProductCategory> {

    /**
    * Indicates that this subscriber only listen to ProductCategory events.
    */
    listenTo() {
        return ProductCategory;
    }

    /**
     * Called after entity is loaded from the database.
     *
     * @param entity
     */
    async afterEntityLoad(entity: ProductCategory): Promise<void> {
        if (!!entity['image']) {
            entity.imageUrl = entity.image.fullUrl || entity.imageUrl;
        }
    }
}
