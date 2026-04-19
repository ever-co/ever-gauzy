import { DAO, ISyncDataLogTransaction, IDatabaseProvider } from '../../interfaces';
import { SyncLogTO, TABLE_NAME_SYNC_LOG } from '../dto';
import { ProviderFactory } from '../databases';
import { SyncDataLogTransaction } from '../transactions';

export class SyncDataLogDAO implements DAO<SyncLogTO> {
	private _trx: ISyncDataLogTransaction;
	private _provider: IDatabaseProvider;

	constructor() {
		this._provider = ProviderFactory.instance;
		this._trx = new SyncDataLogTransaction(this._provider);
	}


	public async save(value: SyncLogTO): Promise<void> {
		return this._trx.create(value);
	}

	public async saveAndReturn(value: SyncLogTO): Promise<SyncLogTO> {
		return this._trx.createAndReturn(value);
	}

	public async findOneById(id: number): Promise<SyncLogTO> {
		const result = await this._provider
			.connection<SyncLogTO>(TABLE_NAME_SYNC_LOG)
			.where('id', '=', id);
		return result[0];
	}

	public async update(id: number, value: Partial<SyncLogTO>): Promise<void> {
		return this._trx.update(id, value);
	}

	public async delete(value: Partial<SyncLogTO>): Promise<void> {
		await this._provider
			.connection<SyncLogTO>(TABLE_NAME_SYNC_LOG)
			.where('id', '=', value.id)
			.del();
	}

	public async findAll(): Promise<SyncLogTO[]> {
		const result = await this._provider
			.connection<SyncLogTO>(TABLE_NAME_SYNC_LOG)
			.select('*');
		return result;
	}
}
