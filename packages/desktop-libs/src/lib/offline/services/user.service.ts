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
		const stored = new User(await this.retrieve());
		if (stored.id !== user.id) {
			await this._userDAO.save(user);
		} else {
			await this.update(user);
		}
	}

	public async update(user: Partial<UserTO>): Promise<void> {
		await this._userDAO.update(user.id, user);
	}

	public async retrieve(): Promise<UserTO> {
		return await this._userDAO.findAll()[0];
	}

	public async remove(user: UserTO): Promise<void> {
		await this._userDAO.delete(user);
	}
}
