import { ICommand } from '@nestjs/cqrs';

/** Records a use of the stored token named by its id: its last use becomes now. */
export class TouchTokenCommand implements ICommand {
	constructor(public readonly tokenId: string) {}
}
