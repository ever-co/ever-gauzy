import { BadRequestException } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { IMention } from '@gauzy/contracts';
import { CreateMentionEvent } from '../mention.event';
import { MentionService } from '../../mention.service';

@EventsHandler(CreateMentionEvent)
export class CreateMentionEventHandler implements IEventHandler<CreateMentionEvent> {
	constructor(private readonly mentionService: MentionService) {}

	/**
	 * Handles the `CreateMentionEvent` by creating a new mention using the provided input.
	 *
	 * @param {CreateMentionEvent} event - The mention event containing the data required to create a mention.
	 * @returns {Promise<IMention>} A promise that resolves to the newly created mention entry.
	 *
	 */
	async handle(event: CreateMentionEvent): Promise<IMention> {
		try {
			// Extract the input from the event.
			const { input } = event;
			return await this.mentionService.create(input);
		} catch (error) {
			console.log(`Error while creating mention: ${error.message}`, error);
			throw new BadRequestException('Error while creating mention', error);
		}
	}
}
