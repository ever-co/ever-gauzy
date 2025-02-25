import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { GetTimerStatusCommand } from '../commands';
import { TimerStatusUpdatedEvent } from '../events';
import { ITimerStatus } from '@gauzy/contracts';
import { TimerService } from '../timer.service';

@Injectable()
@CommandHandler(GetTimerStatusCommand)
export class GetTimerStatusHandler implements ICommandHandler<GetTimerStatusCommand> {
  constructor(
    private readonly timerService: TimerService,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: GetTimerStatusCommand): Promise<ITimerStatus> {
    const { input } = command;

    // Use the existing implementation
    const status = await this.timerService._getTimerStatusImplementation(input);

    // Publish the event
    this.eventBus.publish(new TimerStatusUpdatedEvent(status));

    return status;
  }
}
