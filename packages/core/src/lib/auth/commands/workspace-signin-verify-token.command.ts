import { ILastOrganization, ILastTeam, IUserEmailInput, IUserTokenInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class WorkspaceSigninVerifyTokenCommand implements ICommand {
	static readonly type = '[Password Less] Workspace Signin Verify Token';

	constructor(public readonly input: IUserEmailInput & IUserTokenInput & ILastOrganization & ILastTeam) {}
}
