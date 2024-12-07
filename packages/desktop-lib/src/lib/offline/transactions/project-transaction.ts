import { Knex } from 'knex';
import { AppError } from '../../error-handler';
import { ITransaction, IDatabaseProvider } from '../../interfaces';
import { ProjectTO, TABLE_NAME_PROJECTS } from '../dto';

export class ProjectTransaction implements ITransaction<ProjectTO> {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}
	public async create(value: ProjectTO): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx.insert(value).into(TABLE_NAME_PROJECTS);
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('PROJECTRX', error);
				}
			}
		);
	}

	public async update(id: number, value: Partial<ProjectTO>): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx(TABLE_NAME_PROJECTS)
						.where('id', '=', id)
						.update(value);
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('PROJECTRX', error);
				}
			}
		);
	}
}
