import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export class RestoreDocumentVersionCommand implements ICommand {
	public static readonly type = '[Document Version] Restore';
	constructor(public readonly id: ID, public readonly versionId: ID) {}
}
