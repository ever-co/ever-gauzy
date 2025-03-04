import { IEvent } from '@nestjs/cqrs';
import { ITimeLog } from '@gauzy/contracts';

export class TimerStoppedEvent implements IEvent {
	constructor(public readonly timeLog: ITimeLog) {}
}
