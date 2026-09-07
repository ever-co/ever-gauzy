import { ICommand } from '@nestjs/cqrs';
import { ReorderDocumentsDTO } from '../dto';

export class ReorderDocumentsCommand implements ICommand {
	public static readonly type = '[Document] Reorder';
	constructor(public readonly input: ReorderDocumentsDTO) {}
}
