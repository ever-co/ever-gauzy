import { ICommand } from '@nestjs/cqrs';
import { BulkDocumentActionDTO } from '../dto';

export class BulkDocumentActionCommand implements ICommand {
	public static readonly type = '[Document] Bulk Action';
	constructor(public readonly input: BulkDocumentActionDTO) {}
}
