import { ICommand } from '@nestjs/cqrs';
import { ITimerStatusInput } from '@gauzy/contracts';

export class GetTimerStatusCommand implements ICommand {
  constructor(public readonly input: ITimerStatusInput) {}
}
