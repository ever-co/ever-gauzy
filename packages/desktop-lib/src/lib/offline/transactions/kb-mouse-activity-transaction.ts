
import { Knex } from 'knex';
import { AppError } from '../../error-handler';
import { IKbMouseTransaction, IDatabaseProvider } from '../../interfaces';
import { KbMouseActivityTO, TABLE_NAME_KB_MOUSE_ACTIVITY } from '../dto';

export class KbMouseTransaction implements IKbMouseTransaction {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}

	public async create(value: KbMouseActivityTO): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx
						.insert(value)
						.into(TABLE_NAME_KB_MOUSE_ACTIVITY)
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('KB_MOUSE_TRX', error);
				}
			}
		);
	}

	public async update(id: number, value: Partial<KbMouseActivityTO>): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx(TABLE_NAME_KB_MOUSE_ACTIVITY)
						.where('id', '=', id)
						.update(value);
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('KB_MOUSE_TRX', error);
				}
			}
		);
	}
}
