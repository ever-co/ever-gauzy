import { IDatabaseProvider } from 'lib/interfaces/i-database-provider';
import { IntervalTO, TABLE_NAME_INTERVAL } from '../dto/interval.dto';
import { Knex } from 'knex';
import { IIntervalTransaction } from 'lib/interfaces/i-interval-transaction';

export class IntervalTransaction implements IIntervalTransaction {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}

	public async create(value: IntervalTO): Promise<void> {
		try {
			await this._databaseProvider.connection.transaction(
				async (trx: Knex.Transaction) => {
					trx.insert(value)
						.into(TABLE_NAME_INTERVAL)
						.then(() => {
							trx.commit;
							console.log(
								'[trx]: ',
								'insertion transaction committed...'
							);
						})
						.catch((error) => {
							trx.rollback;
							console.log(
								'[trx]: ',
								'insertion transaction rollback...'
							);
							console.warn('[trx]: ', error);
						});
				}
			);
		} catch (error) {
			console.log('[trx]: ', error);
		}
	}

	public async update(id: number, value: IntervalTO): Promise<void> {
		try {
			await this._databaseProvider.connection.transaction(
				async (trx: Knex.Transaction) => {
					await trx(TABLE_NAME_INTERVAL)
						.where('id', '=', id)
						.update(value)
						.then(trx.commit)
						.catch(trx.rollback);
				}
			);
		} catch (error) {
			console.log('[trx]: ', error);
		}
	}

	public async synced(
		offlineStartAt: Date,
		offlineEndAt: Date
	): Promise<void> {
		try {
			await this._databaseProvider.connection
				.transaction(async (trx: Knex.Transaction) => {
					await trx
						.select('*')
						.from(TABLE_NAME_INTERVAL)
						.whereBetween('startAt', [offlineStartAt, offlineEndAt])
						.then((intervals: IntervalTO[]) => {
							intervals.forEach(async (interval: IntervalTO) => {
								await trx
									.update('synced', true)
									.where('id', interval.id);
							});
						})
						.then(trx.commit)
						.catch(trx.rollback);
				})
				.then()
				.catch((error) => {
					console.log('[trx]: ', error);
				});
		} catch (error) {
			console.log('[trx]: ', error);
		}
	}
}
