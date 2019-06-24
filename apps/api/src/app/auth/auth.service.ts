
import { Injectable } from '@nestjs/common';
import { UserService } from '../user';

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UserService
    ){}

    async register(input) {
        const user = await this.userService.create({
			email: input.email
			// ...(input.password
			// 	? {
			// 			hash: await this.authService.getPasswordHash(
			// 				input.password
			// 			)
			// 	  }
			// 	: {})
        });
        
		return user;
    }

}
