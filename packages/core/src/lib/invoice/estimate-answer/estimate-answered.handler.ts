import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { EstimateAnsweredEvent } from './estimate-answered.event';
import { EstimateAnswerNotifier } from './estimate-answer-notifier.service';

/**
 * Hands a client's answer to an estimate to `EstimateAnswerNotifier`. A failure is logged, never raised: the answer is
 * saved already, and an event handler that throws would surface on the event bus.
 */
@EventsHandler(EstimateAnsweredEvent)
export class EstimateAnsweredHandler implements IEventHandler<EstimateAnsweredEvent> {
	private readonly logger = new Logger(EstimateAnsweredHandler.name);

	constructor(private readonly estimateAnswerNotifier: EstimateAnswerNotifier) {}

	async handle(event: EstimateAnsweredEvent): Promise<void> {
		try {
			await this.estimateAnswerNotifier.notify(event.answer);
		} catch (error) {
			this.logger.error(`The answer to estimate ${event.answer.invoiceId} reached nobody: ${error?.message}`);
		}
	}
}
