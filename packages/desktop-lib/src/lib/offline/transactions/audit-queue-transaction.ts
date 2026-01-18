import { Knex } from 'knex';
import { AppError } from '../../error-handler';
import { IAuditQueueTransaction, IDatabaseProvider } from '../../interfaces';
import { AuditQueueTO, TABLE_NAME_AUDIT_QUEUE } from '../dto';

export class AuditQueueTransaction implements IAuditQueueTransaction {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}

	public async createAndReturn(value: AuditQueueTO): Promise<AuditQueueTO> {
		const [row] = await this._databaseProvider.connection.transaction(async (trx: Knex.Transaction) => {
			try {
				const data = await trx
					.insert(value)
					.into(TABLE_NAME_AUDIT_QUEUE)
					.onConflict('queue_id')
					.merge({
						status: trx.raw('excluded.status'),
						attempts: trx.raw(
							'CASE WHEN audit_queue.status = excluded.status THEN audit_queue.attempts ELSE audit_queue.attempts + 1 END'
						)
					})
					.returning('*');
				return data;
			} catch (error) {
				throw new AppError('AUDIT_QUEUE_TRX', error);
			}
		});
		return row;
	}

	async create(_: AuditQueueTO): Promise<void> {
		throw new Error(
			'create() method is not used. ' + 'Use createAndReturn() instead to ensure transaction safety.'
		);
	}

	public async update(id: number, value: Partial<AuditQueueTO>): Promise<void> {
		await this._databaseProvider.connection.transaction(async (trx: Knex.Transaction) => {
			try {
				await trx(TABLE_NAME_AUDIT_QUEUE).where('queue_id', '=', id).update(value);
				await trx.commit();
			} catch (error) {
				await trx.rollback();
				throw new AppError('AUDIT_QUEUE_TRX', error);
			}
		});
	}

	public async updatePartial(id: number, value: Partial<AuditQueueTO>): Promise<AuditQueueTO> {
		const [row] = await this._databaseProvider.connection.transaction(async (trx: Knex.Transaction) => {
			try {
				const data = await trx(TABLE_NAME_AUDIT_QUEUE).where('queue_id', '=', id).update(value).returning('*');
				return data;
			} catch (error) {
				throw new AppError('AUDIT_QUEUE_TRX', error);
			}
		});
		return row;
	}
}
