import { Knex } from 'knex';
import { AppError } from '../../error-handler';
import { IIntervalTransaction, IDatabaseProvider } from '../../interfaces';
import { IntervalTO, TABLE_NAME_INTERVALS } from '../dto';

export class IntervalTransaction implements IIntervalTransaction {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}

	public async create(value: IntervalTO): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx.insert(value).into(TABLE_NAME_INTERVALS);
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('INTERTRX', error);
				}
			}
		);
	}

	public async update(id: number, value: IntervalTO): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx(TABLE_NAME_INTERVALS)
						.where('id', '=', id)
						.update(value);
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('INTERTRX', error);
				}
			}
		);
	}

	public async synced(
		offlineStartAt: Date,
		offlineEndAt: Date
	): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					const intervals: IntervalTO[] = await trx
						.select('*')
						.from(TABLE_NAME_INTERVALS)
						.whereBetween('startAt', [
							offlineStartAt,
							offlineEndAt,
						]);

					for (const interval of intervals) {
						await trx
							.update('synced', true)
							.where('id', interval.id);
					}

					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('INTERVTRX', error);
				}
			}
		);
	}
}
