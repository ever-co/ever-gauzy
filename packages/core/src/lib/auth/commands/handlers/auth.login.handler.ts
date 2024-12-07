import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IUserLoginInput, IAuthResponse } from '@gauzy/contracts';
import { AuthLoginCommand } from '../auth.login.command';
import { AuthService } from '../../auth.service';

@CommandHandler(AuthLoginCommand)
export class AuthLoginHandler implements ICommandHandler<AuthLoginCommand> {
	constructor(private readonly authService: AuthService) {}

	/**
	 * Executes the authentication login command.
	 *
	 * @param command The authentication login command containing user input.
	 * @returns A promise that resolves to an authentication response or null.
	 */
	public async execute(command: AuthLoginCommand): Promise<IAuthResponse | null> {
		const { input } = command;
		const { email, password }: IUserLoginInput = input;

		return await this.authService.login({ email, password });
	}
}
