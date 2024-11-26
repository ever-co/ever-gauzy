import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { IMention } from '@gauzy/contracts';
import { MentionEvent } from '../mention.event';
import { MentionService } from '../../mention.service';

@EventsHandler(MentionEvent)
export class MentionEventHandler implements IEventHandler<MentionEvent> {
	constructor(private readonly mentionService: MentionService) {}

	/**
	 * Handles the `MentionEvent` by creating a new mention using the provided input.
	 *
	 * @param {MentionEvent} event - The mention event containing the data required to create a mention.
	 * @returns {Promise<IMention>} A promise that resolves to the newly created mention entry.
	 *
	 */
	async handle(event: MentionEvent): Promise<IMention> {
		// Extract the input from the event.
		const { input } = event;
		return await this.mentionService.create(input);
	}
}
