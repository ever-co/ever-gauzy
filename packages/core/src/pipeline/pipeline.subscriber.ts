import { EventSubscriber } from "typeorm";
import { Pipeline } from "./pipeline.entity";
import { BaseEntityEventSubscriber } from "../core/entities/subscribers/base-entity-event.subscriber";

@EventSubscriber()
export class PipelineSubscriber extends BaseEntityEventSubscriber<Pipeline> {

    /**
    * Indicates that this subscriber only listen to Pipeline events.
    */
    listenTo() {
        return Pipeline;
    }

    /**
     * Called after loading the Pipeline entity from the database.
     *
     * @param entity - The loaded Pipeline entity.
     */
    async afterEntityLoad(entity: Pipeline): Promise<void> {
        try {
            this.__after_fetch(entity);
        } catch (error) {
            console.error('PipelineSubscriber: An error occurred during the afterEntityLoad process:', error);
        }
    }

    /**
     * Called before entity is inserted/created to the database.
     *
     * @param entity
     */
    async beforeEntityCreate(entity: Pipeline): Promise<void> {
        try {
            const pipelineId = entity?.id ? { pipelineId: entity?.id } : {};
            let index = 0;

            entity?.stages?.forEach((stage) => {
                Object.assign(stage, pipelineId, { index: ++index });
            });
        } catch (error) {
            console.error('PipelineSubscriber: An error occurred during the beforeEntityCreate process:', error);
        }
    }

    /**
     * Called after inserting the Pipeline entity into the database.
     *
     * @param entity
     */
    async afterEntityCreate(entity: Pipeline): Promise<void> {
        try {
            this.__after_fetch(entity);
        } catch (error) {
            console.error('PipelineSubscriber: An error occurred during the afterEntityCreate process:', error);
        }
    }

    /***
     * Internal method to be used after fetching the Pipeline entity.
     *
     * @param entity - The fetched Pipeline entity.
     */
    private __after_fetch(entity: Pipeline): void {
        if (entity.stages) {
            entity.stages.sort(({ index: a }, { index: b }) => a - b);
        }
    }
}
