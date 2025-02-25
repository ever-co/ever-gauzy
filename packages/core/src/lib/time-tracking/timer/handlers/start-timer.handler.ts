import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { StartTimerCommand } from '../commands';
import { TimerStartedEvent } from '../events';
import { ITimeLog } from '@gauzy/contracts';
import { TimerService } from '../timer.service';

@Injectable()
@CommandHandler(StartTimerCommand)
export class StartTimerHandler implements ICommandHandler<StartTimerCommand> {
  constructor(
    private readonly timerService: TimerService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: StartTimerCommand): Promise<ITimeLog> {
    const { input } = command;

    // Use the existing implementation
    const timeLog = await this.timerService._startTimerImplementation(input);
    
    this.eventBus.publish(new TimerStartedEvent(timeLog));

    return timeLog;
  }
}
