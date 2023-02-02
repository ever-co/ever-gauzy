import { UserService } from '.';
import { Timer, TimerDAO, TimerTO } from '..';
import { ITimerService } from '../../interfaces';

export class TimerService implements ITimerService<TimerTO> {
	private _timerDAO: TimerDAO;
	private _userService: UserService;
	constructor() {
		this._timerDAO = new TimerDAO();
		this._userService = new UserService();
	}
	public async findLastOne(): Promise<TimerTO> {
		try {
			const user = await this._userService.retrieve();
			return await this._timerDAO.lastTimer(user.employeeId);
		} catch (error) {
			console.error('[ERRORSERVICETIMER]', error);
		}
	}
	public async findLastCapture(): Promise<TimerTO> {
		try {
			const user = await this._userService.retrieve();
			return await this._timerDAO.lastCapture(user.employeeId);
		} catch (error) {
			console.error('[ERRORSERVICETIMER]', error);
		}
	}
	public async update(timer: Partial<Timer>): Promise<void> {
		try {
			await this._timerDAO.update(timer.id, timer.toObject());
		} catch (error) {
			console.error('[ERRORSERVICETIMER]', error);
		}
	}
	public async findAll(): Promise<TimerTO[]> {
		try {
			return await this._timerDAO.findAll();
		} catch (error) {
			console.error('[ERRORSERVICETIMER]', error);
		}
	}
	public async findById(timer: Partial<Timer>): Promise<TimerTO> {
		try {
			return await this._timerDAO.findOneById(timer.id);
		} catch (error) {}
	}
	public async remove(timer: Partial<Timer>): Promise<void> {
		try {
			await this._timerDAO.delete(timer);
		} catch (error) {
			console.error('[ERRORSERVICETIMER]', error);
		}
	}

	public async save(timer: Timer): Promise<void> {
		try {
			await this._timerDAO.save(timer.toObject());
		} catch (error) {
			console.error('[TIMERERROR]: ', error);
		}
	}

	public async findNoSynced(): Promise<TimerTO[]> {
		try {
			const user = await this._userService.retrieve();
			return await this._timerDAO.findAllNoSynced(user);
		} catch (error) {
			console.error('[NOSYNCEDTIMERERROR]: ', error);
		}
	}
}
