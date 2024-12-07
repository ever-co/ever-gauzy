import { DAO, IDatabaseProvider, IUserTransaction } from '../../interfaces';
import { ProviderFactory } from '../databases';
import { TABLE_NAME_USERS, UserTO } from '../dto';
import { UserTransaction } from '../transactions';

export class UserDAO implements DAO<UserTO> {
	private _trx: IUserTransaction;
	private _provider: IDatabaseProvider;

	constructor() {
		this._provider = ProviderFactory.instance;
		this._trx = new UserTransaction(this._provider);
	}

	public async findAll(): Promise<UserTO[]> {
		return await this._provider
			.connection<UserTO>(TABLE_NAME_USERS)
			.select('*');
	}
	public async save(value: UserTO): Promise<void> {
		await this._trx.create(value);
	}
	public async findOneById(id: number): Promise<UserTO> {
		return await this._provider
			.connection<UserTO>(TABLE_NAME_USERS)
			.where('id', '=', id)[0];
	}
	public async update(id: number, value: Partial<UserTO>): Promise<void> {
		await this._trx.update(id, value);
	}
	public async delete(value?: Partial<UserTO>): Promise<void> {
		await this._provider.connection<UserTO>(TABLE_NAME_USERS).del();
	}

	public async current(): Promise<UserTO> {
		const [user] = await this._provider
			.connection<UserTO>(TABLE_NAME_USERS)
			.orderBy('id', 'desc')
			.limit(1);
		return user;
	}
}
