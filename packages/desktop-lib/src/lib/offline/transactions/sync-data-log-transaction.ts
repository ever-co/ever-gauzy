import { Knex }  from 'knex';
import { ISyncDataLogTransaction } from '../../interfaces/i-sync-data-log-transaction';
import { IDatabaseProvider } from '../../interfaces';
import { SyncLogTO, TABLE_NAME_SYNC_LOG } from '../dto';
import { AppError } from '../../error-handler';

export class SyncDataLogTransaction implements ISyncDataLogTransaction {
	private _databaseProvider: IDatabaseProvider

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}

	public async create(value: SyncLogTO): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx) => {
				try {
					await trx
						.insert(value)
						.into(TABLE_NAME_SYNC_LOG);
				} catch (error) {
					throw new AppError('SYNC_LOG_TRX', error);
				}
			}
		);
	}

	public async createAndReturn(value: SyncLogTO): Promise<SyncLogTO> {
		const [row] = await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					const result = await trx
						.insert(value)
						.into(TABLE_NAME_SYNC_LOG)
						.returning('*');
					return result;
				} catch (error) {
					throw new AppError('SYNC_LOG_TRX', error);
				}
			}
		);
		return row;
	}

	public async update(id: number, value: Partial<SyncLogTO>): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx
					.table(TABLE_NAME_SYNC_LOG)
					.where('id', '=', id)
					.update(value);
				} catch (error) {
					throw new AppError('UPDATE_SYNC_LOG_TRX', error);
				}
			}
		);
	}
}
