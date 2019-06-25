
import { Injectable } from '@nestjs/common';
import { User, UserService } from '../user';
import { IUserRegistrationInput } from './user-registration-input';
import * as bcrypt from 'bcrypt';
import { environment as env } from '@env-api/environment'
import { CommandBus } from '@nestjs/cqrs';
import { AuthRegisterCommand } from './commands';

// have to combine the two imports
import * as jwt from 'jsonwebtoken';
import { JsonWebTokenError } from 'jsonwebtoken';

@Injectable()
export class AuthService {
	saltRounds: number;

	constructor(
		private readonly commandBus: CommandBus,
		private readonly userService: UserService
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

	async login(
		findObj: any,
		password: string
	): Promise<{ user: User; token: string } | null> {
		const user = await this.userService.findOne(findObj)

		if (!user || !(await bcrypt.compare(password, user.hash))) {
			return null;
		}

		const token = jwt.sign(
			{ id: user.id }, // TODO role: this.role },
			env.JWT_SECRET,
			{}
		); // Never expires

		delete user.hash;

		return {
			user,
			token
		};
	}
}
