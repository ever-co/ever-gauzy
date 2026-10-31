import { Knex } from 'knex';
import { AppError } from '../../error-handler';
import { IAuditQueueTransaction, IDatabaseProvider } from '../../interfaces';
import { AuditQueueTO, TABLE_NAME_AUDIT_QUEUE } from '../dto';
import { PRIMARY_KEY_COLUMN, toUpdatePayload, warnEmptyUpdate } from '../utils';

/** A queue row is addressed by its `queue_id` (and has its own `id`): an update rewrites neither. */
const AUDIT_QUEUE_KEY_COLUMNS = [PRIMARY_KEY_COLUMN, 'queue_id'];

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
		const changes = toUpdatePayload(value, AUDIT_QUEUE_KEY_COLUMNS);
		if (!changes) {
			return warnEmptyUpdate('AUDIT_QUEUE_TRX', id);
		}
		await this._databaseProvider.connection.transaction(async (trx: Knex.Transaction) => {
			try {
				await trx(TABLE_NAME_AUDIT_QUEUE).where('queue_id', '=', id).update(changes);
				await trx.commit();
			} catch (error) {
				await trx.rollback();
				throw new AppError('AUDIT_QUEUE_TRX', error);
			}
		});
	}

	public async updatePartial(id: number, value: Partial<AuditQueueTO>): Promise<AuditQueueTO> {
		const changes = toUpdatePayload(value, AUDIT_QUEUE_KEY_COLUMNS);
		if (!changes) {
			// Nothing to write: the row as it stands, which is what the UPDATE ... RETURNING below would have answered.
			return this._databaseProvider
				.connection<AuditQueueTO>(TABLE_NAME_AUDIT_QUEUE)
				.where('queue_id', '=', id)
				.first();
		}
		const [row] = await this._databaseProvider.connection.transaction(async (trx: Knex.Transaction) => {
			try {
				const data = await trx(TABLE_NAME_AUDIT_QUEUE)
					.where('queue_id', '=', id)
					.update(changes)
					.returning('*');
				return data;
			} catch (error) {
				throw new AppError('AUDIT_QUEUE_TRX', error);
			}
		});
		return row;
	}
}
