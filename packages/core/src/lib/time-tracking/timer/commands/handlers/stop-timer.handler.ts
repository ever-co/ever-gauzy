import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { StopTimerCommand } from '../../commands';
import { TimerStoppedEvent } from '../../events';
import { ITimeLog } from '@gauzy/contracts';
import { TimerService } from '../../timer.service';

@Injectable()
@CommandHandler(StopTimerCommand)
export class StopTimerHandler implements ICommandHandler<StopTimerCommand> {
  constructor(
    private readonly timerService: TimerService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: StopTimerCommand): Promise<ITimeLog> {
    const { input } = command;

    // Use the existing implementation
    const timeLog = await this.timerService.stopTimer(input);

    this.eventBus.publish(new TimerStoppedEvent(timeLog));

    return timeLog;
  }
}
