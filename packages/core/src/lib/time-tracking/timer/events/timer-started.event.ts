import { IEvent } from '@nestjs/cqrs';
import { ITimeLog } from '@gauzy/contracts';

export class TimerStartedEvent implements IEvent {
  constructor(public readonly timeLog: ITimeLog) {}
}
