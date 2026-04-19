import { ISyncDataLogService } from '../../interfaces';
import { SyncLogTO } from '../dto';
import { SyncDataLogDAO } from '../dao';
import { AppError } from '../../error-handler';
import { SyncDataLog } from '../models/sync-data.model';

export class SyncDataLogService implements ISyncDataLogService<SyncLogTO> {
	private _dao: SyncDataLogDAO;

	constructor() {
		this._dao = new SyncDataLogDAO();
	}

	public async save(log: SyncDataLog): Promise<void> {
		if (!log) {
			return console.error('WARN[SYNC_DATA_LOG_SERVICE]: No log data, cannot save');
		}

		try {
			await this._dao.save(log.toObject());
		} catch (error) {
			new AppError('SYNC_DATA_LOG_SERVICE', error);
		}
	}

	public async saveAndReturn(log: SyncDataLog): Promise<SyncLogTO | null> {
		if (!log) {
			console.error('WARN[SYNC_DATA_LOG_SERVICE]: No log data, cannot save');
			return null;
		}

		try {
			return await this._dao.saveAndReturn(log.toObject());
		} catch (error) {
			throw new AppError('SYNC_DATA_LOG_SERVICE', error);
		}
	}

	public async findAll(): Promise<SyncLogTO[]> {
		try {
			return await this._dao.findAll();
		} catch (error) {
			throw new AppError('SYNC_DATA_LOG_SERVICE', error);
		}
	}

	public async findById(id: number): Promise<SyncLogTO | null> {
		try {
			if (!id) {
				console.error('WARN[SYNC_DATA_LOG_SERVICE]: No log ID, cannot find');
				return null;
			}
			return await this._dao.findOneById(id);
		} catch (error) {
			throw new AppError('SYNC_DATA_LOG_SERVICE', error);
		}
	}

	public async deleteById(id: number): Promise<void> {
		try {
			if (!id) {
				return console.error('WARN[SYNC_DATA_LOG_SERVICE]: No log ID, cannot delete');
			}
			return await this._dao.delete({id: id});
		} catch (error) {
			throw new AppError('SYNC_DATA_LOG_SERVICE', error);
		}
	}

	public async update(id: number, log: Partial<SyncDataLog>): Promise<void> {
		try {
			if (!id) {
				return console.error('WARN[SYNC_DATA_LOG_SERVICE]: No log ID, cannot update');
			}
			await this._dao.update(id, log.toObject());
		} catch (error) {
			throw new AppError('SYNC_DATA_LOG_SERVICE', error);
		}
	}
}
