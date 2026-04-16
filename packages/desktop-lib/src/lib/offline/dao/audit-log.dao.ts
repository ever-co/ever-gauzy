import { DAO, ITransactionAuditLog, IDatabaseProvider } from '../../interfaces';
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
		if (!value || value.createdAt) {
			console.error('Cannot delete audit log data: Missing or invalid createdAt timestamp');
		}
		await this._provider
			.connection<AuditLogTO>(TABLE_NAME_AUDIT_LOG)
			.where('createdAt', '>=', value?.id)
			.andWhere('createdAt', '<=', value?.createdAt)
			.del();
	}
}
