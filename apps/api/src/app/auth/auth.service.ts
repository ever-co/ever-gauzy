
import { Injectable } from '@nestjs/common';
import { User } from '../user';
import { IUserRegistrationInput } from './user-registration-input';
import * as bcrypt from 'bcrypt';
import { environment as env } from '@env-api/environment'
import { CommandBus } from '@nestjs/cqrs';
import { AuthRegisterCommand } from './commands';

@Injectable()
export class AuthService {
	saltRounds: number;

	constructor(
		private readonly commandBus: CommandBus
	) {
		this.saltRounds = env.USER_PASSWORD_BCRYPT_SALT_ROUNDS;
	}

	async getPasswordHash(password: string): Promise<string> {
		return bcrypt.hash(password, this.saltRounds);
	}

	async register(input: IUserRegistrationInput): Promise<User> {
		return this.commandBus.execute(
			new AuthRegisterCommand(input)
		);
	}
}
