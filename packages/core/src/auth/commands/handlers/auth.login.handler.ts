import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IUserLoginInput, IAuthResponse, IUserTokenInput } from '@gauzy/contracts';
import { AuthLoginCommand } from '../auth.login.command';
import { AuthService } from '../../auth.service';

@CommandHandler(AuthLoginCommand)
export class AuthLoginHandler implements ICommandHandler<AuthLoginCommand> {

	constructor(
		private readonly authService: AuthService
	) { }

	public async execute(command: AuthLoginCommand): Promise<IAuthResponse | null> {
		const { input } = command;
		const { email, password, token }: IUserLoginInput & Partial<IUserTokenInput> = input;

		return await this.authService.login({ email, password, token });
	}
}
