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

    // Use the existing implementation
    const status = await this.timerService.getTimerStatus(input);

    // Publish the event
    this.eventBus.publish(new TimerStatusUpdatedEvent(status));

    return status;
  }
}
