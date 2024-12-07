import { Knex } from 'knex';
import { AppError } from '../../error-handler';
import { ITimerTransaction, IDatabaseProvider } from '../../interfaces';
import { TABLE_NAME_TIMERS, TimerTO } from '../dto';

export class TimerTransaction implements ITimerTransaction {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}
	public async create(value: TimerTO): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx.insert(value).into(TABLE_NAME_TIMERS);
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('TIMERTRX', error);
				}
			}
		);
	}

	public async update(id: number, value: Partial<TimerTO>): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx(TABLE_NAME_TIMERS)
						.where('id', '=', id)
						.update(value);
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('TIMERTRX', error);
				}
			}
		);
	}
}
