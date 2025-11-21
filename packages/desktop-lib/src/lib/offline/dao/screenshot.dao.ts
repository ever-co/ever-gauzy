
import { DAO, IDatabaseProvider, IScreenshotTransaction } from '../../interfaces';
import { ProviderFactory } from '../databases';
import { TABLE_NAME_SCREENSHOT, ScreenshotTO } from '../dto';
import { ScreenshotTransaction } from '../transactions';

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

	public async findOneById(id: number): Promise<ScreenshotTO | undefined> {
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
			throw new Error('Cannot delete activity: Missing or invalid id');
		}
		await this._provider
			.connection<ScreenshotTO>(TABLE_NAME_SCREENSHOT)
			.where('id', '=', value.id)
			.del();
	}

	public async findUnSyncedScreenshot(): Promise<ScreenshotTO[] | undefined> {
		const screenshots = await this._provider
			.connection<ScreenshotTO>(TABLE_NAME_SCREENSHOT)
			.where('synced', false)
		return screenshots;
	}
}
