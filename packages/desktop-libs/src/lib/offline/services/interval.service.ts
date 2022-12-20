import { IOfflineMode } from 'lib/interfaces';
import { IIntervalService } from '../../interfaces/i-interval-service';
import { IntervalDAO } from '../dao/interval-dao';
import { DesktopOfflineModeHandler } from '../desktop-offline-mode-handler';
import { IntervalTO } from '../dto/interval.dto';

export class IntervalService implements IIntervalService<IntervalTO> {
	private _intervalDAO: IntervalDAO;
	private _offlineMode: IOfflineMode;
	constructor() {
		this._intervalDAO = new IntervalDAO();
		this._offlineMode = DesktopOfflineModeHandler.instance;
	}
	public async create(interval: IntervalTO): Promise<void> {
		await this._intervalDAO.save(interval);
	}
	public async backedUpNoSynced(): Promise<IntervalTO[]> {
		return this._intervalDAO.backedUpNoSynced(
			this._offlineMode.startAt,
			this._offlineMode.endAt
		);
	}
	public async destroy(interval: Partial<IntervalTO>): Promise<void> {
		await this._intervalDAO.delete(interval);
	}
	public async synced(interval: IntervalTO): Promise<void> {
		interval.synced = true;
		await this._intervalDAO.update(interval.id, interval);
	}
}
