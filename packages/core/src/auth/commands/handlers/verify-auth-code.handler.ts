import { UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VerifyAuthCodeCommand } from '../verify-auth-code.command';
import { AuthService } from '../../auth.service';

@CommandHandler(VerifyAuthCodeCommand)
export class VerifyAuthCodeHandler implements ICommandHandler<VerifyAuthCodeCommand> {

	constructor(
		private readonly authService: AuthService
	) {}

	public async execute(command: VerifyAuthCodeCommand): Promise<any> {
		try {
			const { input } = command;
			return await this.authService.verifyAuthCode(input);
		} catch (error) {
			throw new UnauthorizedException();
		}
	}
}
