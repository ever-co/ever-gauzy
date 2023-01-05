import { IUserService } from '../../interfaces';
import { UserDAO } from '../dao';
import { UserTO } from '../dto';

export class UserService implements IUserService<UserTO> {
	private _userDAO: UserDAO;

	constructor() {
		this._userDAO = new UserDAO();
	}

	public async save(user: UserTO): Promise<void> {
		const stored = await this.retrieve();
		if (stored && stored.id === user.id) {
			await this.update(user);
			return;
		} 
		await this._userDAO.save(user);
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
