import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { ReprocessDocumentDTO } from '../dto';

export class ReprocessDocumentCommand implements ICommand {
	public static readonly type = '[Document] Reprocess';
	constructor(public readonly id: ID, public readonly input: ReprocessDocumentDTO) {}
}
