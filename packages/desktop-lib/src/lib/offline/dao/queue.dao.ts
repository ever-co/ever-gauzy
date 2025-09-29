import { DAO, IDatabaseProvider, IAuditQueueTransaction } from '../../interfaces';
import { ProviderFactory } from '../databases';
import { TABLE_NAME_AUDIT_QUEUE, AuditQueueTO } from '../dto';
import { AuditQueueTransaction } from '../transactions';

export class AuditQueueDAO implements DAO<AuditQueueTO> {
	private _trx: IAuditQueueTransaction;
	private _provider: IDatabaseProvider;

	constructor() {
		this._provider = ProviderFactory.instance;
		this._trx = new AuditQueueTransaction(this._provider);
	}

	public async findAll(): Promise<AuditQueueTO[]> {
		return await this._provider.connection<AuditQueueTO>(TABLE_NAME_AUDIT_QUEUE).select('*');
	}
	public async pageAndFilter(page: number, limit: number, status: string): Promise<AuditQueueTO[]> {
		return await this._provider
			.connection<AuditQueueTO>(TABLE_NAME_AUDIT_QUEUE)
			.select('*')
			.where('status', '=', status)
			.orderBy('created_at', 'desc')
			.limit(limit)
			.offset(page * limit);
	}
	public async save(value: AuditQueueTO): Promise<void> {
		await this._trx.create(value);
	}

	public async findOneById(id: number): Promise<AuditQueueTO | undefined> {
		const result = await this._provider
			.connection<AuditQueueTO>(TABLE_NAME_AUDIT_QUEUE)
			.where('id', '=', id);
		return result[0];
	}
	public async update(id: number, value: Partial<AuditQueueTO>): Promise<void> {
		await this._trx.update(id, value);
	}
	public async updatePartial(id: string, value: Partial<AuditQueueTO>): Promise<void> {
		await this._trx.updatePartial(id, value);
	}
	public async delete(value?: Partial<AuditQueueTO>): Promise<void> {
		if (!value || value.id === undefined) {
			throw new Error('Cannot delete activity: Missing or invalid id');
		}
		await this._provider
			.connection<AuditQueueTO>(TABLE_NAME_AUDIT_QUEUE)
			.where('id', '=', value.id)
			.del();
	}

	public async current(id: string): Promise<AuditQueueTO | undefined> {
		const [activities] = await this._provider
			.connection<AuditQueueTO>(TABLE_NAME_AUDIT_QUEUE)
			.andWhere('id', id)
			.orderBy('created_at', 'desc')
			.limit(1);
		return activities;
	}
}
