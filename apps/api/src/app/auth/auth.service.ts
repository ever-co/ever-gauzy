
import { Injectable } from '@nestjs/common';
import { UserService, User } from '../user';
import { IUserRegistrationInput } from './user-registration-input';
import * as bcrypt from 'bcrypt';
import {environment as env} from '@env-api/environment'

@Injectable()
export class AuthService {
	saltRounds: number;

    constructor(
        private readonly userService: UserService
	){
		this.saltRounds = env.USER_PASSWORD_BCRYPT_SALT_ROUNDS;
	}
	
	async getPasswordHash(password: string): Promise<string> {
		return bcrypt.hash(password, this.saltRounds);
	}

    async register(input: IUserRegistrationInput): Promise<User> { 
        const user = await this.userService.create({
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

}
