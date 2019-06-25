import { User } from '../user';

export interface IUserRegistrationInput {
	user: User;
	password?: string;
}
