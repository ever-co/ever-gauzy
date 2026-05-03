
import { DAO, IDatabaseProvider, IScreenshotTransaction } from '../../interfaces';
import { ProviderFactory } from '../databases';
import { TABLE_NAME_SCREENSHOT, ScreenshotTO } from '../dto';
import { ScreenshotTransaction } from '../transactions';

const SCREENSHOT_RETRIES_LIMIT = 3;

export class ScreenshotDAO implements DAO<ScreenshotTO> {
	private _trx: IScreenshotTransaction;
	private _provider: IDatabaseProvider;

	constructor() {
		this._provider = ProviderFactory.instance;
		this._trx = new ScreenshotTransaction(this._provider);
	}

	public async findAll(): Promise<ScreenshotTO[]> {
		return await this._provider.connection<ScreenshotTO>(TABLE_NAME_SCREENSHOT).select('*');
	}
	public async save(value: ScreenshotTO): Promise<void> {
		return this._trx.create(value);
	}

	public async saveAndReturn(value: ScreenshotTO): Promise<ScreenshotTO> {
		return this._trx.createAndReturn(value);
	}

	public async findOneById(id: number): Promise<ScreenshotTO> {
		const result = await this._provider
			.connection<ScreenshotTO>(TABLE_NAME_SCREENSHOT)
			.where('id', '=', id);
		return result[0];
	}
	public async update(id: number, value: Partial<ScreenshotTO>): Promise<void> {
		await this._trx.update(id, value);
	}
	public async delete(value?: Partial<ScreenshotTO>): Promise<void> {
		if (!value || value.id === undefined) {
			throw new Error('Cannot delete screenshot data: Missing or invalid id');
		}
		await this._provider
			.connection<ScreenshotTO>(TABLE_NAME_SCREENSHOT)
			.where('id', '=', value.id)
			.orWhere('imagePath', '=', value.imagePath)
			.del();
	}

	public async findUnSyncedScreenshot(limit?: number): Promise<ScreenshotTO[]> {
		const query = this._provider.connection<ScreenshotTO>(TABLE_NAME_SCREENSHOT);
		if (limit) {
			query.limit(limit);
		}
		const screenshots = await query
			.whereNotNull('imagePath')
			.andWhere('synced', false)
			.andWhere((qb) =>
				qb.whereNull('retries').orWhere('retries', '<=', SCREENSHOT_RETRIES_LIMIT)
			)
			.orderBy('lastAttemptAt', 'asc')
		return screenshots;
	}
}
