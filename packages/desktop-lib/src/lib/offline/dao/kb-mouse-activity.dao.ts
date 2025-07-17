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
		return await this._provider.connection<KbMouseActivityTO>(TABLE_NAME_KB_MOUSE_ACTIVITY).select('*');
	}
	public async save(value: KbMouseActivityTO): Promise<void> {
		await this._trx.create(value);
	}
	public async findOneById(id: number): Promise<KbMouseActivityTO | undefined> {
		const result = await this._provider
			.connection<KbMouseActivityTO>(TABLE_NAME_KB_MOUSE_ACTIVITY)
			.where('id', '=', id);
		return result[0];
	}
	public async update(id: number, value: Partial<KbMouseActivityTO>): Promise<void> {
		await this._trx.update(id, value);
	}
	public async delete(value?: Partial<KbMouseActivityTO>): Promise<void> {
		if (!value || value.id === undefined) {
			throw new Error('Cannot delete activity: Missing or invalid id');
		}
		await this._provider
			.connection<KbMouseActivityTO>(TABLE_NAME_KB_MOUSE_ACTIVITY)
			.where('id', '=', value.id)
			.del();
	}

	public async current(remoteId: string, organizationId: string, tenantId: string): Promise<KbMouseActivityTO | undefined> {
		const [activities] = await this._provider
			.connection<KbMouseActivityTO>(TABLE_NAME_KB_MOUSE_ACTIVITY)
			.where('tenantId', tenantId)
			.andWhere('organizationId', organizationId)
			.andWhere('remoteId', remoteId)
			.orderBy('timeStart', 'desc')
			.limit(1);
		return activities;
	}
}
