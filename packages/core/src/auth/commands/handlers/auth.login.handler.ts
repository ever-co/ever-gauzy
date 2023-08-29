import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IUserLoginInput, IAuthResponse } from '@gauzy/contracts';
import { AuthLoginCommand } from '../auth.login.command';
import { AuthService } from '../../auth.service';

@CommandHandler(AuthLoginCommand)
export class AuthLoginHandler implements ICommandHandler<AuthLoginCommand> {

	constructor(
		private readonly authService: AuthService
	) { }

	public async execute(command: AuthLoginCommand): Promise<IAuthResponse | void> {
		const { input } = command;
		const { email, password, magic_code }: IUserLoginInput = input;

		return await this.authService.login({ email, password, magic_code });
	}
}
