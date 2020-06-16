import { ICommand } from '@nestjs/cqrs';

export class CandidatePersonalQualitiesBulkDeleteCommand implements ICommand {
	static readonly type = '[CandidatePersonalQualities] Delete';

	constructor(public readonly id: string) {}
}
