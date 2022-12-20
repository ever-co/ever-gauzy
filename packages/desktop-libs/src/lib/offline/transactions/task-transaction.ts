import { IDatabaseProvider } from 'lib/interfaces/i-database-provider';
import { ITransaction } from 'lib/interfaces/i-transaction';
import { Knex } from 'knex';
import { TABLE_NAME_TASKS, TaskTO } from '../dto/task.dto';

export class TaskTransaction implements ITransaction<TaskTO> {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}

	public async create(value: TaskTO): Promise<void> {
		try {
			await this._databaseProvider.connection.transaction(
				async (trx: Knex.Transaction) => {
					trx.insert(value)
						.into(TABLE_NAME_TASKS)
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

	public async update(id: number, value: Partial<TaskTO>): Promise<void> {
		try {
			await this._databaseProvider.connection.transaction(
				async (trx: Knex.Transaction) => {
					await trx(TABLE_NAME_TASKS)
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
}
