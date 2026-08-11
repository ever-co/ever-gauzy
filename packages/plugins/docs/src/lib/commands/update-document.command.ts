import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { UpdateDocumentDTO } from '../dto';

export class UpdateDocumentCommand implements ICommand {
	public static readonly type = '[Document] Update';
	constructor(public readonly id: ID, public readonly input: UpdateDocumentDTO) {}
}
