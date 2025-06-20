import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class RecoverCamshotCommand implements ICommand {
	constructor(public readonly id: ID) { }
}
