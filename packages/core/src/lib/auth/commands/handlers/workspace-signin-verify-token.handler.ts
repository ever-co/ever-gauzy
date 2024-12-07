import { UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IAuthResponse } from '@gauzy/contracts';
import { WorkspaceSigninVerifyTokenCommand } from '../workspace-signin-verify-token.command';
import { AuthService } from '../../auth.service';

@CommandHandler(WorkspaceSigninVerifyTokenCommand)
export class WorkspaceSigninVerifyTokenHandler implements ICommandHandler<WorkspaceSigninVerifyTokenCommand> {

	constructor(
		private readonly authService: AuthService
	) { }

	public async execute(command: WorkspaceSigninVerifyTokenCommand): Promise<IAuthResponse | null> {
		try {
			const { input } = command;
			return await this.authService.workspaceSigninVerifyToken(input);
		} catch (error) {
			throw new UnauthorizedException();
		}
	}
}
