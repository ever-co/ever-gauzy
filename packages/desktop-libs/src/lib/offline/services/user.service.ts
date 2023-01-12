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
		await this._userDAO.save(user);
	}

	public async update(user: Partial<UserTO>): Promise<void> {
		await this._userDAO.update(user.id, user);
	}

	public async retrieve(): Promise<UserTO> {
		const userDao = await this._userDAO.current();
		const user = new User(userDao);
		user.employee = JSON.parse(user.employee as string);
		return user;
	}

	public async remove(): Promise<void> {
		await this._userDAO.delete();
	}
}
