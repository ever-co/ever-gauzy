import { ICommand } from '@nestjs/cqrs';

export class CandidateTechnologiesBulkDeleteCommand implements ICommand {
	static readonly type = '[CandidateTechnologies] Delete';

	constructor(public readonly id: string) {}
}
