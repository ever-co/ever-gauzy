import { IUserTransaction } from '../../interfaces/i-user-transaction';
import { DAO } from '../../interfaces/i-dao';
import { ProviderFactory } from '../databases/provider-factory';
import { UserTO } from '../dto/user.dto';
import { UserTransaction } from '../transactions/user-transaction';

export class UserDao implements DAO<UserTO> {
	private _trx: IUserTransaction;
	private _provider: ProviderFactory;

	constructor() {
		this._provider = new ProviderFactory();
		this._trx = new UserTransaction(this._provider);
	}

	findAll(): Promise<UserTO[]> {
		throw new Error('Method not implemented.');
	}
	public async save(value: UserTO): Promise<void> {
		await this._trx.create(value);
	}
	findOneById(id: number): Promise<UserTO> {
		throw new Error('Method not implemented.');
	}
	public async update(id: number, value: Partial<UserTO>): Promise<void> {
		await this._trx.update(id, value);
	}
	public async delete(value: Partial<UserTO>): Promise<void> {
		throw new Error('Method not implemented.');
	}
}
