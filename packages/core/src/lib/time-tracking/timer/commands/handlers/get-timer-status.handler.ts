import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { GetTimerStatusQuery } from '../../commands';
import { TimerStatusUpdatedEvent } from '../../events';
import { ITimerStatus } from '@gauzy/contracts';
import { TimerService } from '../../timer.service';

@Injectable()
@CommandHandler(GetTimerStatusQuery)
export class GetTimerStatusHandler implements ICommandHandler<GetTimerStatusQuery> {
  constructor(
    private readonly timerService: TimerService,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: GetTimerStatusQuery): Promise<ITimerStatus> {
    const { input } = command;

    try {
       // Get timer status
      const status = await this.timerService.getTimerStatus(input);

        // Publish the event
      this.eventBus.publish(new TimerStatusUpdatedEvent(status));
        return status;
      } catch (error) {
        // Log the error
      console.error('Error getting timer status:', error);
      throw error;
    }
  }
}
