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
     * Called after a ProductCategory entity is loaded from the database. This method updates
     * the entity's imageUrl if an associated image with a full URL is present.
     *
     * @param entity The ProductCategory entity that has been loaded.
     * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
     */
    async afterEntityLoad(entity: ProductCategory): Promise<void> {
        try {
            // Update the imageUrl if an associated image with a full URL is present
            if (entity.image && entity.image.fullUrl) {
                entity.imageUrl = entity.image.fullUrl;
            }
        } catch (error) {
            console.error(`ProductCategorySubscriber: An error occurred during the afterEntityLoad process for entity ID ${entity.id}:`, error);
        }
    }
}
