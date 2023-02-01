import { Knex } from 'knex';
import { IUserTransaction, IDatabaseProvider } from '../../interfaces';
import { UserTO, TABLE_NAME_USERS } from '../dto';

export class UserTransaction implements IUserTransaction {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}

	public async create(value: UserTO): Promise<void> {
		try {
			await this._databaseProvider.connection.transaction(async (trx: Knex.Transaction) => {
				trx.insert(value)
					.into(TABLE_NAME_USERS)
					.onConflict('remoteId')
					.merge()
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

	public async update(id: number, value: Partial<UserTO>): Promise<void> {
		try {
			await this._databaseProvider.connection.transaction(async (trx: Knex.Transaction) => {
				await trx(TABLE_NAME_USERS).where('id', '=', id).update(value).then(trx.commit).catch(trx.rollback);
			});
		} catch (error) {
			console.log('[trx]: ', error);
		}
	}
}
