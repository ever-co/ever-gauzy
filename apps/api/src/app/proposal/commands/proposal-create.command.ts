import { ICommand } from '@nestjs/cqrs';
import { IProposalCreateInput } from '@gauzy/models';

export class ProposalCreateCommand implements ICommand {
	static readonly type = '[Proposal] Create Proposal';

	constructor(public readonly input: IProposalCreateInput) {}
}
