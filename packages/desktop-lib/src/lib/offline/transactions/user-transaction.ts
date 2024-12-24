import { Knex } from 'knex';
import { AppError } from '../../error-handler';
import { IUserTransaction, IDatabaseProvider } from '../../interfaces';
import { UserTO, TABLE_NAME_USERS } from '../dto';

export class UserTransaction implements IUserTransaction {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}

	public async create(value: UserTO): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx
						.insert(value)
						.into(TABLE_NAME_USERS)
						.onConflict('remoteId')
						.merge();
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('USERTRX', error);
				}
			}
		);
	}

	public async update(id: number, value: Partial<UserTO>): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx(TABLE_NAME_USERS)
						.where('id', '=', id)
						.update(value);
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('USERTRX', error);
				}
			}
		);
	}
}
