import { IDatabaseProvider, ITransactionAuditLog } from "../../interfaces";
import { AuditLogTO, TABLE_NAME_AUDIT_LOG } from "../dto";
import { AppError } from "../../error-handler";
import { Knex } from "knex";

export class AuditLogTransaction implements ITransactionAuditLog {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}

	public async create(value: AuditLogTO): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx) => {
				try {
					await trx
					.insert(value)
					.into(TABLE_NAME_AUDIT_LOG);
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					console.error('Error creating audit log entry:', error);
				}
			}
		);
	}

	public async update(id: number, value: Partial<AuditLogTO>): Promise<void> {
		console.log('Updating audit log entry with id:', id, 'and value:', value);
	}

	public async createAndReturn(value: AuditLogTO): Promise<AuditLogTO> {
		const [row] = await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					const data = await trx
						.insert(value)
						.into(TABLE_NAME_AUDIT_LOG)
						.returning('*');
					return data;
				} catch (error) {
					throw new AppError('AUDIT_LOG_TRX', error);
				}
			}
		);
		return row;
	}
}
