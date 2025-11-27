
import { Knex } from 'knex';
import { AppError } from '../../error-handler';
import { IScreenshotTransaction, IDatabaseProvider } from '../../interfaces';
import { ScreenshotTO, TABLE_NAME_SCREENSHOT } from '../dto';

export class ScreenshotTransaction implements IScreenshotTransaction {
	private _databaseProvider: IDatabaseProvider;

	constructor(databaseProvider: IDatabaseProvider) {
		this._databaseProvider = databaseProvider;
	}

	public async create(value: ScreenshotTO): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx
						.insert(value)
						.into(TABLE_NAME_SCREENSHOT)
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('SCREENSHOT_TRX', error);
				}
			}
		);
	}

	public async createAndReturn(value: ScreenshotTO): Promise<ScreenshotTO> {
		const [row] = await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					const data = await trx
						.insert(value)
						.into(TABLE_NAME_SCREENSHOT)
						.onConflict('imagePath').ignore()
						.returning('*');
					return data;
				} catch (error) {
					throw new AppError('SCREENSHOT_TRX', error);
				}
			}
		);
		return row;
	}

	public async update(id: number, value: Partial<ScreenshotTO>): Promise<void> {
		await this._databaseProvider.connection.transaction(
			async (trx: Knex.Transaction) => {
				try {
					await trx(TABLE_NAME_SCREENSHOT)
						.where('id', '=', id)
						.update(value);
					await trx.commit();
				} catch (error) {
					await trx.rollback();
					throw new AppError('SCREENSHOT_TRX', error);
				}
			}
		);
	}
}
