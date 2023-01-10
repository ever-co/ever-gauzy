import { IIntervalService, IOfflineMode } from '../../interfaces';
import { IntervalDAO } from '../dao';
import { DesktopOfflineModeHandler } from '../desktop-offline-mode-handler';
import { IntervalTO } from '../dto';
import { Interval } from '../models';

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
			this._offlineMode.startedAt,
			this._offlineMode.stoppedAt
		);
	}
	public async destroy(interval: Partial<IntervalTO>): Promise<void> {
		await this._intervalDAO.delete(interval);
	}
	public async synced(interval: IntervalTO): Promise<void> {
		const intervalToUpdate = new Interval(interval);
		intervalToUpdate.synced = true;
		intervalToUpdate.activities = JSON.stringify(
			intervalToUpdate.activities
		);
		intervalToUpdate.screenshots = JSON.stringify(
			intervalToUpdate.screenshots
		) as any;
		await this._intervalDAO.update(
			intervalToUpdate.id,
			intervalToUpdate.toObject()
		);
	}
	public async backedUpAllNoSynced(): Promise<IntervalTO[]> {
		return await this._intervalDAO.findAllSynced(false);
	}
}
