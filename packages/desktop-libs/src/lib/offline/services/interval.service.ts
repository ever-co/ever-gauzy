import { IIntervalService, IOfflineMode } from '../../interfaces';
import { IntervalDAO } from '../dao';
import { DesktopOfflineModeHandler } from '../desktop-offline-mode-handler';
import { IntervalTO } from '../dto';
import { Interval } from '../models';
import { UserService } from './user.service';

export class IntervalService implements IIntervalService<IntervalTO> {
	private _intervalDAO: IntervalDAO;
	private _userService: UserService;
	private _offlineMode: IOfflineMode;
	constructor() {
		this._intervalDAO = new IntervalDAO();
		this._userService = new UserService();
		this._offlineMode = DesktopOfflineModeHandler.instance;
	}
	public async create(interval: IntervalTO): Promise<void> {
		interval.activities = JSON.stringify(interval.activities);
		interval.screenshots = JSON.stringify(interval.screenshots) as any;
		await this._intervalDAO.save(interval);
	}
	public async backedUpNoSynced(): Promise<IntervalTO[]> {
		const user = await this._userService.retrieve();
		return await this._intervalDAO.backedUpNoSynced(this._offlineMode.startedAt, this._offlineMode.stoppedAt, user);
	}
	public async destroy(interval: Partial<IntervalTO>): Promise<void> {
		await this._intervalDAO.delete(interval);
	}
	public async synced(interval: IntervalTO): Promise<void> {
		const intervalToUpdate = new Interval(interval);
		intervalToUpdate.synced = true;
		intervalToUpdate.activities = JSON.stringify(intervalToUpdate.activities);
		intervalToUpdate.screenshots = JSON.stringify(intervalToUpdate.screenshots) as any;
		await this._intervalDAO.update(intervalToUpdate.id, intervalToUpdate.toObject());
	}
	public async backedUpAllNoSynced(): Promise<IntervalTO[]> {
		const user = await this._userService.retrieve();
		return await this._intervalDAO.findAllSynced(false, user);
	}
	public async countNoSynced(): Promise<number> {
		const user = await this._userService.retrieve();
		const [res] = await this._intervalDAO.count(false, user);
		return res.total;
	}
	public async screenshots(): Promise<any[]> {
		const user = await this._userService.retrieve();
		return await this._intervalDAO.screenshots(user);
	}

	public async removeIdlesTime(startedAt: Date, stoppedAt: Date): Promise<string[]> {
		const user = await this._userService.retrieve();
		const remoteIds = await this._intervalDAO.deleteIdlesTime(startedAt, stoppedAt, user);
		return remoteIds.map(({ remoteId }) => remoteId);
	}
}
