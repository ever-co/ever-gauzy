import { UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { WorkspeceSigninVerifyTokenCommand } from '../workspace-signin-verify-token.command';
import { AuthService } from '../../auth.service';

@CommandHandler(WorkspeceSigninVerifyTokenCommand)
export class WorkspeceSigninVerifyTokenHandler implements ICommandHandler<WorkspeceSigninVerifyTokenCommand> {

	constructor(
		private readonly authService: AuthService
	) { }

	public async execute(command: WorkspeceSigninVerifyTokenCommand): Promise<any> {
		try {
			const { input } = command;
			return await this.authService.workspaceSigninVerifyToken(input);
		} catch (error) {
			throw new UnauthorizedException();
		}
	}
}
