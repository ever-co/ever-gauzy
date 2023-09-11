import { Knex } from 'knex';
import { AppError } from '../../error-handler';
import { IDatabaseProvider, ITaskTransaction } from '../../interfaces';
import { TaskTO, TABLE_NAME_TASKS } from '../dto';

export class TaskTransaction implements ITaskTransaction {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}

	public async create(value: TaskTO): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx.insert(value).into(TABLE_NAME_TASKS);
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('TASKTRX', error);
				}
			}
		);
	}

	public async update(id: number, value: Partial<TaskTO>): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx(TABLE_NAME_TASKS)
						.where('id', '=', id)
						.update(value);
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('TASKTRX', error);
				}
			}
		);
	}
}
