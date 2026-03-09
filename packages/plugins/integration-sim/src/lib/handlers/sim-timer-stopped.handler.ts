import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { TimerStoppedEvent } from '@gauzy/core';
import { SimService } from '../sim.service';

@Injectable()
@EventsHandler(TimerStoppedEvent)
export class SimTimerStoppedHandler implements IEventHandler<TimerStoppedEvent> {
	private readonly logger = new Logger(SimTimerStoppedHandler.name);

	constructor(private readonly simService: SimService) {}

	/**
	 * Handles the TimerStoppedEvent by triggering any SIM workflow mapped to the 'timer.stopped' event.
	 *
	 * @param event - The TimerStoppedEvent containing the time log details.
	 */
	async handle(event: TimerStoppedEvent): Promise<void> {
		try {
			const timeLog = event.timeLog;
			if (!timeLog.tenantId || !timeLog.organizationId) {
				return;
			}

			await this.simService.triggerEventWorkflow({
				event: 'timer.stopped',
				data: timeLog,
				tenantId: timeLog.tenantId,
				organizationId: timeLog.organizationId
			});
		} catch (error: any) {
			this.logger.error('Failed to handle TimerStoppedEvent for SIM workflow trigger', {
				message: error?.message,
				stack: error?.stack
			});
		}
	}
}
