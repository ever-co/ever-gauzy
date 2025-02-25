import { ICommand } from '@nestjs/cqrs';
import { ITimerToggleInput } from '@gauzy/contracts';

export class StopTimerCommand implements ICommand {
  constructor(public readonly input: ITimerToggleInput) {}
}
