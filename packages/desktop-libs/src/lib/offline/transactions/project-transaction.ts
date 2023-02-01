import { Knex } from 'knex';
import { ITransaction, IDatabaseProvider } from '../../interfaces';
import { ProjectTO, TABLE_NAME_PROJECTS } from '../dto';

export class ProjectTransaction implements ITransaction<ProjectTO> {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}
	public async create(value: ProjectTO): Promise<void> {
		try {
			await this._databaseProvider.connection.transaction(async (trx: Knex.Transaction) => {
				trx.insert(value)
					.into(TABLE_NAME_PROJECTS)
					.then(() => {
						trx.commit;
						console.log('[trx]: ', 'insertion transaction committed...');
					})
					.catch((error) => {
						trx.rollback;
						console.log('[trx]: ', 'insertion transaction rollback...');
						console.warn('[trx]: ', error);
					});
			});
		} catch (error) {
			console.log('[trx]: ', error);
		}
	}

	public async update(id: number, value: Partial<ProjectTO>): Promise<void> {
		try {
			await this._databaseProvider.connection.transaction(async (trx: Knex.Transaction) => {
				await trx(TABLE_NAME_PROJECTS).where('id', '=', id).update(value).then(trx.commit).catch(trx.rollback);
			});
		} catch (error) {
			console.log('[trx]: ', error);
		}
	}
}
