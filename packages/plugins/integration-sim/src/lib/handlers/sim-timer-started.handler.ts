import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { TimerStartedEvent } from '@gauzy/core';
import { SimService } from '../sim.service';
import { SimEventName } from '../dto/event-mapping.dto';

@Injectable()
@EventsHandler(TimerStartedEvent)
export class SimTimerStartedHandler implements IEventHandler<TimerStartedEvent> {
	private readonly logger = new Logger(SimTimerStartedHandler.name);

	constructor(private readonly simService: SimService) {}

	/**
	 * Handles the TimerStartedEvent by triggering any SIM workflow mapped to the 'timer.started' event.
	 *
	 * @param event - The TimerStartedEvent containing the time log details.
	 */
	async handle(event: TimerStartedEvent): Promise<void> {
		try {
			const timeLog = event.timeLog;
			if (!timeLog.tenantId || !timeLog.organizationId) {
				return;
			}

			await this.simService.triggerEventWorkflow({
				event: SimEventName['TIMER_STARTED'],
				data: timeLog,
				tenantId: timeLog.tenantId,
				organizationId: timeLog.organizationId
			});
		} catch (error: any) {
			this.logger.error('Failed to handle TimerStartedEvent for SIM workflow trigger', {
				message: error?.message,
				stack: error?.stack
			});
		}
	}
}
