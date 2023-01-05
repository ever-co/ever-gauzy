import { IUserTransaction } from '../../interfaces/i-user-transaction';
import { DAO } from '../../interfaces/i-dao';
import { ProviderFactory } from '../databases/provider-factory';
import { TABLE_NAME_USERS, UserTO } from '../dto/user.dto';
import { UserTransaction } from '../transactions/user-transaction';

export class UserDAO implements DAO<UserTO> {
	private _trx: IUserTransaction;
	private _provider: ProviderFactory;

	constructor() {
		this._provider = new ProviderFactory();
		this._trx = new UserTransaction(this._provider);
	}

	public async findAll(): Promise<UserTO[]> {
		return await this._provider
			.connection<UserTO>(TABLE_NAME_USERS)
			.select('*');
	}
	public async save(value: UserTO): Promise<void> {
		value = {
			...value,
			employee: JSON.stringify(value.employee)
		} as any;
		await this._trx.create(value);
	}
	public async findOneById(id: number): Promise<UserTO> {
		return await this._provider
			.connection<UserTO>(TABLE_NAME_USERS)
			.select('*')
			.where('id', '=', id)[0];
	}
	public async update(id: number, value: Partial<UserTO>): Promise<void> {
		value = {
			...value,
			employee: JSON.stringify(value.employee)
		} as any;
		await this._trx.update(id, value);
	}
	public async delete(value: Partial<UserTO>): Promise<void> {
		await this._provider
			.connection<UserTO>(TABLE_NAME_USERS)
			.where('id', '=', value.id)
			.del();
	}
}
