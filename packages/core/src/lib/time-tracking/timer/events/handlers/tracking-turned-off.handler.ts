import { Logger } from '@nestjs/common';
import { EventBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { TimerService } from '../../timer.service';
import { TimerStoppedEvent } from '../timer-stopped.event';
import { TrackingTurnedOffEvent } from '../tracking-turned-off.event';

@EventsHandler(TrackingTurnedOffEvent)
export class TrackingTurnedOffHandler implements IEventHandler<TrackingTurnedOffEvent> {
	private readonly logger = new Logger(TrackingTurnedOffHandler.name);

	constructor(
		private readonly _timerService: TimerService,
		private readonly _eventBus: EventBus
	) {}

	/**
	 * Stops the timer the employee still has running, so it does not keep counting time nobody can stop from a
	 * client that hides the timer once tracking is off. Best-effort: the change of the tracking switch is saved by
	 * then, and a timer this fails to stop keeps running until a later stop succeeds.
	 */
	async handle(event: TrackingTurnedOffEvent): Promise<void> {
		try {
			const stoppedLogs = await this._timerService.stopRunningTimersOf(event.scope);
			for (const timeLog of stoppedLogs) {
				this._eventBus.publish(new TimerStoppedEvent(timeLog));
			}
		} catch (error) {
			this.logger.error(`Failed to stop the running timers of employee ${event.scope.employeeId}`, error?.stack);
		}
	}
}
