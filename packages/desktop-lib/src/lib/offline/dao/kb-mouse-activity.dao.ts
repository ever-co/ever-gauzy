
import { DAO, IDatabaseProvider, IKbMouseTransaction } from '../../interfaces';
import { ProviderFactory } from '../databases';
import { TABLE_NAME_KB_MOUSE_ACTIVITY, KbMouseActivityTO } from '../dto';
import { KbMouseTransaction } from '../transactions';

export class KbMouseActivityDAO implements DAO<KbMouseActivityTO> {
	private _trx: IKbMouseTransaction;
	private _provider: IDatabaseProvider;

	constructor() {
		this._provider = ProviderFactory.instance;
		this._trx = new KbMouseTransaction(this._provider);
	}

	public async findAll(): Promise<KbMouseActivityTO[]> {
		return await this._provider
			.connection<KbMouseActivityTO>(TABLE_NAME_KB_MOUSE_ACTIVITY)
			.select('*');
	}
	public async save(value: KbMouseActivityTO): Promise<void> {
		await this._trx.create(value);
	}
	public async findOneById(id: number): Promise<KbMouseActivityTO> {
		return await this._provider
			.connection<KbMouseActivityTO>(TABLE_NAME_KB_MOUSE_ACTIVITY)
			.where('id', '=', id)[0];
	}
	public async update(id: number, value: Partial<KbMouseActivityTO>): Promise<void> {
		await this._trx.update(id, value);
	}
	public async delete(value?: Partial<KbMouseActivityTO>): Promise<void> {
		await this._provider.connection<KbMouseActivityTO>(TABLE_NAME_KB_MOUSE_ACTIVITY)
		.where('id', '=', value.id).del();
	}

	public async current(): Promise<KbMouseActivityTO> {
		const [activites] = await this._provider
			.connection<KbMouseActivityTO>(TABLE_NAME_KB_MOUSE_ACTIVITY)
			.orderBy('timeStart', 'asc')
			.limit(1);
		return activites;
	}
}
