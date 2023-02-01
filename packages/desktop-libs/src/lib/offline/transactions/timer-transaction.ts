import { Knex } from 'knex';
import { ITimerTransaction, IDatabaseProvider } from '../../interfaces';
import { TABLE_NAME_TIMERS, TimerTO } from '../dto';

export class TimerTransaction implements ITimerTransaction {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}
	public async create(value: TimerTO): Promise<void> {
		try {
			await this._databaseProvider.connection.transaction(async (trx: Knex.Transaction) => {
				trx.insert(value)
					.into(TABLE_NAME_TIMERS)
					.then(() => {
						trx.commit;
						console.log('[TIMERTRX]: ', 'insertion transaction committed...');
					})
					.catch((error) => {
						trx.rollback;
						console.log('[TIMERTRXER]: ', 'insertion transaction rollback...');
						console.warn('[TIMERTRXER]: ', error);
					});
			});
		} catch (error) {
			console.log('[TIMERTRXER]: ', error);
		}
	}
	public async update(id: number, value: Partial<TimerTO>): Promise<void> {
		try {
			await this._databaseProvider.connection.transaction(async (trx: Knex.Transaction) => {
				await trx(TABLE_NAME_TIMERS).where('id', '=', id).update(value).then(trx.commit).catch(trx.rollback);
			});
		} catch (error) {
			console.log('[TIMERTRXERUPDATE]: ', error);
		}
	}
}
