import { EntitySubscriberInterface, EventSubscriber, LoadEvent } from "typeorm";
import { ProductCategory } from "./product-category.entity";

@EventSubscriber()
export class ProductCategorySubscriber implements EntitySubscriberInterface<ProductCategory> {

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
     * @param event
     */
    afterLoad(entity: ProductCategory, event?: LoadEvent<ProductCategory>): void | Promise<any> {
        if (!!entity['image']) {
            entity.imageUrl = entity.image.fullUrl || entity.imageUrl;
        }
    }
}
