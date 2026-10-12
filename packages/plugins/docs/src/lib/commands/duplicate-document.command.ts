import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { DuplicateDocumentDTO } from '../dto';

export class DuplicateDocumentCommand implements ICommand {
	public static readonly type = '[Document] Duplicate';
	constructor(public readonly id: ID, public readonly input: DuplicateDocumentDTO) {}
}
