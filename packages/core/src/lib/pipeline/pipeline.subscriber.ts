import { EventSubscriber } from 'typeorm';
import { Pipeline } from './pipeline.entity';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';

@EventSubscriber()
export class PipelineSubscriber extends BaseEntityEventSubscriber<Pipeline> {
	/**
	 * Indicates that this subscriber only listen to Pipeline events.
	 */
	listenTo() {
		return Pipeline;
	}

	/**
	 * Called after a Pipeline entity is loaded from the database. This method performs
	 * additional operations defined in the __after_fetch method on the loaded entity.
	 *
	 * @param entity The Pipeline entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the post-load processing is complete.
	 */
	async afterEntityLoad(entity: Pipeline): Promise<void> {
		try {
			this.__after_fetch(entity);
		} catch (error) {
			console.error(
				`PipelineSubscriber: An error occurred during the afterEntityLoad process for Pipeline ID ${entity.id}:`,
				error
			);
		}
	}

	/**
	 * Called before a Pipeline entity is inserted or created in the database. This method
	 * assigns pipeline ID and an index to each stage in the pipeline.
	 *
	 * @param entity The Pipeline entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: Pipeline): Promise<void> {
		try {
			// Assign pipeline ID to each stage and set an incrementing index
			const pipelineId = entity?.id ? { pipelineId: entity.id } : {};
			let index = 0;

			entity?.stages?.forEach((stage) => {
				Object.assign(stage, pipelineId, { index: ++index });
			});
		} catch (error) {
			console.error('PipelineSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}

	/**
	 * Called after a Pipeline entity is inserted into the database. This method performs
	 * additional operations defined in the __after_fetch method on the newly created entity.
	 *
	 * @param entity The Pipeline entity that has been created.
	 * @returns {Promise<void>} A promise that resolves when the post-creation processing is complete.
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
