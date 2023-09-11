import { AppError } from '../../error-handler';
import { IUserService } from '../../interfaces';
import { UserDAO } from '../dao';
import { UserTO } from '../dto';
import { User } from '../models';

export class UserService implements IUserService<UserTO> {
	private _userDAO: UserDAO;

	constructor() {
		this._userDAO = new UserDAO();
	}

	public async save(user: UserTO): Promise<void> {
		try {
			await this._userDAO.save(user);
		} catch (error) {
			throw new AppError('USERSRVCE', error);
		}
	}

	public async update(user: Partial<UserTO>): Promise<void> {
		try {
			await this._userDAO.update(user.id, user);
		} catch (error) {
			throw new AppError('USERSRVCE', error);
		}
	}

	public async retrieve(): Promise<UserTO> {
		try {
			const userDao = await this._userDAO.current();
			const user = new User(userDao);
			user.employee = JSON.parse(user.employee as string);
			return user;
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	public async remove(): Promise<void> {
		try {
			await this._userDAO.delete();
		} catch (error) {
			throw new AppError('USERSRVCE', error);
		}
	}
}
