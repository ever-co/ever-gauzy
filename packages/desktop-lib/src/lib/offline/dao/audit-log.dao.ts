import { DAO, ITransactionAuditLog, IDatabaseProvider, IPagination } from '../../interfaces';
import { ProviderFactory } from '../databases';
import { TABLE_NAME_AUDIT_LOG, AuditLogTO } from '../dto';
import { AuditLogTransaction } from '../transactions';

export class AuditLogDAO implements DAO<AuditLogTO> {
	private _trx: ITransactionAuditLog;
	private _provider: IDatabaseProvider;

	constructor() {
		this._provider = ProviderFactory.instance;
		this._trx = new AuditLogTransaction(this._provider);
	}

	public async findAll(): Promise<AuditLogTO[]> {
		return await this._provider.connection<AuditLogTO>(TABLE_NAME_AUDIT_LOG).select('*');
	}

	public async findByFilter(paginationFilter: IPagination<AuditLogTO>): Promise<AuditLogTO[]> {
		const { filter, limit, page } = paginationFilter;
		const query = this._provider.connection<AuditLogTO>(TABLE_NAME_AUDIT_LOG);
		if (filter?.logLevel !== undefined && filter?.logLevel !== null) {
			query.where('logLevel', filter.logLevel);
		}

		if (filter?.message !== undefined && filter?.message !== null) {
			query.where('message', 'like', `%${filter.message}%`);
		}

		if (filter?.serviceName !== undefined && filter?.serviceName !== null) {
			query.where('serviceName', filter.serviceName);
		}

		const offset = (page) * limit;

		const result = await query
			.select('*')
			.orderBy('createdAt', 'desc')
			.limit(limit)
			.offset(offset);
		return result;
	}

	public async count(filter: Partial<AuditLogTO>): Promise<number> {
		const query = this._provider.connection<AuditLogTO>(TABLE_NAME_AUDIT_LOG);
		if (filter.logLevel !== undefined && filter.logLevel !== null) {
			query.where('logLevel', filter.logLevel);
		}

		if (filter.message !== undefined && filter.message !== null) {
			query.where('message', 'like', `%${filter.message}%`);
		}

		if (filter.serviceName !== undefined && filter.serviceName !== null) {
			query.where('serviceName', filter.serviceName);
		}

		const result = await query.count({ total: 'id' });

		return Number(result[0]?.total) || 0;
	}

	public async save(value: AuditLogTO): Promise<void> {
		return this._trx.create(value);
	}

	public async saveAndReturn(value: AuditLogTO): Promise<AuditLogTO> {
		return this._trx.createAndReturn(value);
	}

	public async update(id: number, value: Partial<AuditLogTO>): Promise<void> {
		return this._trx.update(id, value);
	}

	public async findOneById(id: number): Promise<AuditLogTO> {
		const result = await this._provider
			.connection<AuditLogTO>(TABLE_NAME_AUDIT_LOG)
			.where('id', '=', id);
		return result[0];
	}

	public async delete(value?: Partial<AuditLogTO>): Promise<void> {
		if (!value || !value.createdAt) {
			console.error('Cannot delete audit log data: Missing or invalid createdAt timestamp');
			return;
		}
		await this._provider
			.connection<AuditLogTO>(TABLE_NAME_AUDIT_LOG)
			.where('createdAt', '<=', value?.createdAt)
			.del();
	}
}
