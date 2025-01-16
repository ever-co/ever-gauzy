import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';

@Injectable()
export class EmailCheckService {
	constructor(private readonly userService: UserService) {}

	/**
	 * Checks if an email exists in the database.
	 *
	 * @param email - The email address to check.
	 * @returns `true` if the email exists, otherwise `false`.
	 */
	async doesEmailExist(email: string): Promise<boolean> {
		const count = await this.userService.count({ where: { email } });
		return count > 0;
	}
}
