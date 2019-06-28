
import { Injectable } from '@nestjs/common';
import { User, UserService } from '../user';
import * as bcrypt from 'bcrypt';
import { environment as env } from '@env-api/environment'

// have to combine the two imports
import * as jwt from 'jsonwebtoken';
import { JsonWebTokenError } from 'jsonwebtoken';
import { IUserRegistrationInput } from './user-registration-input';

@Injectable()
export class AuthService {
	saltRounds: number;

	constructor(
		private readonly userService: UserService,
	) {
		this.saltRounds = env.USER_PASSWORD_BCRYPT_SALT_ROUNDS;
	}

	async getPasswordHash(password: string): Promise<string> {
		return bcrypt.hash(password, this.saltRounds);
	}

	async login(
		findObj: any,
		password: string
	): Promise<{ user: User; token: string } | null> {
		const user = await this.userService.findOne(findObj, { relations: ['role'] })

		if (!user || !(await bcrypt.compare(password, user.hash))) {
			return null;
		}

		const token = jwt.sign(
			{ id: user.id, role: user.role ? user.role.name : '' },
			env.JWT_SECRET,
			{}
		); // Never expires

		delete user.hash;

		return {
			user,
			token
		};
	}

	async register(input: IUserRegistrationInput): Promise<User> {
		const user = this.userService.create({
			...input.user,
			...(input.password
				? {
					hash: await this.getPasswordHash(
						input.password
					)
				}
				: {})
		});

		return user;
	}

	async isAuthenticated(token: string): Promise<boolean> {
		try {
			const { id } = jwt.verify(token, env.JWT_SECRET) as {
				id: string;
			};

			return this.userService.checkIfExists(id);
		} catch (err) {
			if (err instanceof JsonWebTokenError) {
				return false;
			} else {
				throw err;
			}
		}
	}

	async hasRole(token: string, roles: string[] = []): Promise<boolean> {
		try {
			const { id, role } = jwt.verify(token, env.JWT_SECRET) as {
				id: string;
				role: string;
			};

			return role ? roles.includes(role) : false;
		} catch (err) {
			if (err instanceof JsonWebTokenError) {
				return false;
			} else {
				throw err;
			}
		}
	}
}
