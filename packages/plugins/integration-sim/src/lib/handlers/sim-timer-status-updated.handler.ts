import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { TimerStatusUpdatedEvent } from '@gauzy/core';
import { SimService } from '../sim.service';
import { SimEventName } from '../dto/event-mapping.dto';

@Injectable()
@EventsHandler(TimerStatusUpdatedEvent)
export class SimTimerStatusUpdatedHandler implements IEventHandler<TimerStatusUpdatedEvent> {
	private readonly logger = new Logger(SimTimerStatusUpdatedHandler.name);

	constructor(private readonly simService: SimService) {}

	/**
	 * Handles the TimerStatusUpdatedEvent by triggering any SIM workflow mapped to the 'timer.status_updated' event.
	 *
	 * @param event - The TimerStatusUpdatedEvent containing the timer status details.
	 */
	async handle(event: TimerStatusUpdatedEvent): Promise<void> {
		try {
			const { status } = event;
			const lastLog = status.lastLog;

			if (!lastLog?.tenantId || !lastLog?.organizationId) {
				return;
			}

			await this.simService.triggerEventWorkflow({
				event: SimEventName['TIMER_STATUS_UPDATED'],
				data: {
					duration: status.duration,
					running: status.running,
					timerStatus: status.timerStatus,
					lastLog,
					lastWorkedTask: status.lastWorkedTask
				},
				tenantId: lastLog.tenantId,
				organizationId: lastLog.organizationId
			});
		} catch (error: any) {
			this.logger.error('Failed to handle TimerStatusUpdatedEvent for SIM workflow trigger', {
				message: error?.message,
				stack: error?.stack
			});
		}
	}
}
