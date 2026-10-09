import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { MoveDocumentDTO } from '../dto';

export class MoveDocumentCommand implements ICommand {
	public static readonly type = '[Document] Move';
	constructor(public readonly id: ID, public readonly input: MoveDocumentDTO) {}
}
