import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent } from "typeorm";
import { Pipeline } from "./pipeline.entity";

@EventSubscriber()
export class PipelineSubscriber implements EntitySubscriberInterface<Pipeline> {

    /**
    * Indicates that this subscriber only listen to Pipeline events.
    */
    listenTo() {
        return Pipeline;
    }

    /**
    * Called before entity is inserted to the database.
    *
    * @param event
    */
    beforeInsert(event: InsertEvent<Pipeline>): void | Promise<any> {
        try {
            const pipelineId = event.entity?.id ? { pipelineId: event.entity?.id } : {};
            let index = 0;

            event.entity?.stages?.forEach((stage) => {
                Object.assign(stage, pipelineId, { index: ++index });
            });
        } catch (error) {
            console.error("Error in beforeInsert:", error.message);
        }
    }

    /**
     * Called after loading the Pipeline entity from the database.
     *
     * @param entity - The loaded Pipeline entity.
     * @param event - The LoadEvent containing information about the load operation.
     */
    afterLoad(entity: Pipeline, event?: LoadEvent<Pipeline>): void | Promise<any> {
        this.__after_fetch(entity);
    }

    /**
     * Called after inserting the Pipeline entity into the database.
     *
     * @param event - The InsertEvent containing information about the insertion.
     */
    afterInsert(event: InsertEvent<Pipeline>): void | Promise<any> {
        this.__after_fetch(event.entity);
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
