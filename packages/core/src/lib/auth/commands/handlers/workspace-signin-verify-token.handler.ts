import { UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IAuthResponse } from '@gauzy/contracts';
import { WorkspaceSigninVerifyTokenCommand } from '../workspace-signin-verify-token.command';
import { AuthService } from '../../auth.service';
import { TwoFactorRequiredException } from '../../two-factor/two-factor-challenge';

@CommandHandler(WorkspaceSigninVerifyTokenCommand)
export class WorkspaceSigninVerifyTokenHandler implements ICommandHandler<WorkspaceSigninVerifyTokenCommand> {
	constructor(private readonly authService: AuthService) {}

	public async execute(command: WorkspaceSigninVerifyTokenCommand): Promise<IAuthResponse | null> {
		try {
			const { input } = command;
			return await this.authService.workspaceSigninVerifyToken(input);
		} catch (error) {
			// The workspace's account asks for its two-factor code: the 403 carries the challenge to answer.
			if (error instanceof TwoFactorRequiredException) {
				throw error;
			}
			throw new UnauthorizedException();
		}
	}
}
