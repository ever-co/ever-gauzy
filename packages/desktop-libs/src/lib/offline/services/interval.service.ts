import { TimerService } from './timer.service';
import { AppError } from '../../error-handler';
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
	private _timerService: TimerService;

	constructor() {
		this._intervalDAO = new IntervalDAO();
		this._userService = new UserService();
		this._timerService = new TimerService();
		this._offlineMode = DesktopOfflineModeHandler.instance;
	}
	public async create(interval: IntervalTO): Promise<void> {
		try {
			interval.activities = JSON.stringify(interval.activities);
			interval.screenshots = JSON.stringify(interval.screenshots) as any;
			await this._intervalDAO.save(interval);
		} catch (error) {
			throw new AppError('INTERVALSRVCE', error);
		}
	}
	public async backedUpNoSynced(): Promise<IntervalTO[]> {
		try {
			const user = await this._userService.retrieve();
			return await this._intervalDAO.backedUpNoSynced(
				this._offlineMode.startedAt,
				this._offlineMode.stoppedAt,
				user
			);
		} catch (error) {
			console.error(error);
			return [];
		}
	}
	public async destroy(interval: Partial<IntervalTO>): Promise<void> {
		try {
			await this._intervalDAO.delete(interval);
		} catch (error) {
			throw new AppError('INTERVALSRVCE', error);
		}
	}
	public async synced(interval: IntervalTO): Promise<void> {
		try {
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
		} catch (error) {
			throw new AppError('INTERVALSRVCE', error);
		}
	}
	public async backedUpAllNoSynced(): Promise<IntervalTO[]> {
		try {
			const user = await this._userService.retrieve();
			return await this._intervalDAO.findAllSynced(false, user);
		} catch (error) {
			console.error(error);
			return [];
		}
	}
	public async countNoSynced(): Promise<number> {
		try {
			const user = await this._userService.retrieve();
			const [res] = await this._intervalDAO.count(false, user);
			const total = await this._timerService.countNoSynced();
			return res.total > 0 ? res.total : total;
		} catch (error) {
			console.error(error);
			return 0;
		}
	}
	public async screenshots(): Promise<any[]> {
		try {
			const user = await this._userService.retrieve();
			return await this._intervalDAO.screenshots(user);
		} catch (error) {
			console.error(error);
			return [];
		}
	}

	public async removeIdlesTime(
		startedAt: Date,
		stoppedAt: Date
	): Promise<string[]> {
		try {
			const user = await this._userService.retrieve();
			let remoteIds = [];
			this._offlineMode.enabled
				? await this._intervalDAO.deleteLocallyIdlesTime(
					startedAt,
					stoppedAt,
					user
				)
				: (remoteIds = await this._intervalDAO.deleteIdlesTime(
					startedAt,
					stoppedAt,
					user
				));
			return remoteIds.map(({ remoteId }) => remoteId);
		} catch (error) {
			console.error(error);
			return [];
		}
	}

	/**
	 * It deletes the interval with the given id
	 * @param {number} id - number - The id of the interval to remove
	 */
	public async remove(id: number): Promise<void> {
		try {
			await this._intervalDAO.delete({ id });
		} catch (error) {
			throw new AppError('INTERVALSRVCE', error);
		}
	}
}
