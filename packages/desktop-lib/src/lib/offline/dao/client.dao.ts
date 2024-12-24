import { DAO, IClientFilterOption, IDatabaseProvider } from '../../interfaces';
import { ProviderFactory } from '../databases';
import { ClientTO, TABLE_NAME_CLIENTS } from '../dto';

export class ClientDAO implements DAO<ClientTO> {
	private _provider: IDatabaseProvider;

	constructor() {
		this._provider = ProviderFactory.instance;
	}

	public async findAll(): Promise<ClientTO[]> {
		return await this._provider
			.connection<ClientTO>(TABLE_NAME_CLIENTS)
			.select('*');
	}
	public async save(value: ClientTO): Promise<void> {
		await this._provider
			.connection<ClientTO>(TABLE_NAME_CLIENTS)
			.insert(value);
	}
	public async findOneById(id: number): Promise<ClientTO> {
		return await this._provider
			.connection<ClientTO>(TABLE_NAME_CLIENTS)
			.select('*')
			.where('id', id)[0];
	}
	public async update(id: number, value: Partial<ClientTO>): Promise<void> {
		await this._provider
			.connection<ClientTO>(TABLE_NAME_CLIENTS)
			.where('id', '=', id)
			.update(value);
	}
	public async delete(value: Partial<ClientTO>): Promise<void> {
		await this._provider
			.connection(TABLE_NAME_CLIENTS)
			.where('id', '=', value.id)
			.del();
	}

	public async findOneByOptions(
		options: IClientFilterOption
	): Promise<ClientTO> {
		const { clientId, remoteId, name } = options;
		return this._provider
			.connection(TABLE_NAME_CLIENTS)
			.where('id', '=', clientId)
			.orWhere('remoteId', '=', remoteId)
			.orWhere('name', '=', name)[0];
	}
}
