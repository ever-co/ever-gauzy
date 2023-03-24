import { UserService } from '.';
import { IntervalDAO, Timer, TimerDAO, TimerTO } from '..';
import { ITimerService } from '../../interfaces';

export class TimerService implements ITimerService<TimerTO> {
	private _timerDAO: TimerDAO;
	private _userService: UserService;
	private _intervalDAO: IntervalDAO;
	constructor() {
		this._timerDAO = new TimerDAO();
		this._intervalDAO = new IntervalDAO();
		this._userService = new UserService();
	}
	public async findLastOne(): Promise<TimerTO> {
		try {
			const user = await this._userService.retrieve();
			return await this._timerDAO.lastTimer(user.employeeId);
		} catch (error) {
			console.error('[ERROR_SERVICE_TIMER]', error);
		}
	}
	public async findLastCapture(): Promise<TimerTO> {
		try {
			const user = await this._userService.retrieve();
			return await this._timerDAO.lastCapture(user.employeeId);
		} catch (error) {
			console.error('[ERROR_SERVICE_TIMER]', error);
		}
	}
	public async update(timer: Partial<Timer>): Promise<void> {
		try {
			await this._timerDAO.update(timer.id, timer.toObject());
		} catch (error) {
			console.error('[ERROR_SERVICE_TIMER]', error);
		}
	}
	public async findAll(): Promise<TimerTO[]> {
		try {
			return await this._timerDAO.findAll();
		} catch (error) {
			console.error('[ERROR_SERVICE_TIMER]', error);
		}
	}
	public async findById(timer: Partial<Timer>): Promise<TimerTO> {
		try {
			return await this._timerDAO.findOneById(timer.id);
		} catch (error) { }
	}
	public async remove(timer: Partial<Timer>): Promise<void> {
		try {
			await this._timerDAO.delete(timer);
		} catch (error) {
			console.error('[ERROR_SERVICE_TIMER]', error);
		}
	}

	public async save(timer: Timer): Promise<void> {
		try {
			await this._timerDAO.save(timer.toObject());
		} catch (error) {
			console.error('[TIMER_ERROR]: ', error);
		}
	}

	public async findNoSynced(): Promise<TimerTO[]> {
		try {
			const user = await this._userService.retrieve();
			return await this._timerDAO.findAllNoSynced(user);
		} catch (error) {
			console.error('[NO_SYNCED_TIMER_ERROR]: ', error);
		}
	}

	public async findToSynced() {
		try {
			const user = await this._userService.retrieve();
			const noSyncedTimers = await this.findNoSynced();
			return noSyncedTimers.map(async (timer) => {
				timer.stoppedAt = timer.stoppedAt
					? timer.stoppedAt
					: new Date();
				const intervals = await this._intervalDAO.backedUpNoSynced(
					timer.startedAt,
					timer.stoppedAt,
					user
				);
				return {
					timer: timer,
					intervals: intervals
				};
			});
		} catch (error) {
			console.log('ERROR_TO_SYNCED', error);
		}
	}
}
