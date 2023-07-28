import { ProviderFactory } from '../databases';
import {
	DAO,
	ITimerTransaction,
	IDatabaseProvider,
	ISequence,
} from '../../interfaces';
import {
	TABLE_NAME_TIMERS,
	TABLE_NAME_INTERVALS,
	TimerTO,
	UserTO,
	IntervalTO,
} from '../dto';
import { TimerTransaction } from '../transactions';

export class TimerDAO implements DAO<TimerTO> {
	private _trx: ITimerTransaction;
	private _provider: IDatabaseProvider;

	constructor() {
		this._provider = ProviderFactory.instance;
		this._trx = new TimerTransaction(this._provider);
	}
	public async findAll(): Promise<TimerTO[]> {
		return await this._provider
			.connection<TimerTO>(TABLE_NAME_TIMERS)
			.select('*');
	}
	public async save(value: TimerTO): Promise<void> {
		await this._trx.create(value);
	}
	public async findOneById(id: number): Promise<TimerTO> {
		const [timer] = await this._provider
			.connection<TimerTO>(TABLE_NAME_TIMERS)
			.select('*')
			.where('id', '=', id);
		return timer;
	}
	public async update(id: number, value: Partial<TimerTO>): Promise<void> {
		await this._trx.update(id, value);
	}
	public async delete(value: Partial<TimerTO>): Promise<void> {
		await this._provider
			.connection<TimerTO>(TABLE_NAME_TIMERS)
			.where('id', '=', value.id)
			.del();
	}

	public async lastCapture(employeeId: string): Promise<TimerTO> {
		const [lastCapture] = await this._provider
			.connection<TimerTO>(TABLE_NAME_TIMERS)
			.where('employeeId', employeeId)
			.where((qb) => qb.orWhereNotNull('timeslotId'))
			.orderBy('id', 'desc')
			.limit(1);
		return lastCapture;
	}

	public async lastTimer(employeeId: string): Promise<TimerTO> {
		const [last] = await this._provider
			.connection<TimerTO>(TABLE_NAME_TIMERS)
			.where('employeeId', employeeId)
			.orderBy('id', 'desc')
			.limit(1);
		return last;
	}

	public async findAllNoSynced(user: UserTO): Promise<ISequence[]> {
		const timers = await this._provider
			.connection<TimerTO>(TABLE_NAME_TIMERS)
			.select(
				`${TABLE_NAME_TIMERS}.*`,
				`${TABLE_NAME_INTERVALS}.id as intervalId`
			)
			.join(
				TABLE_NAME_INTERVALS,
				`${TABLE_NAME_TIMERS}.id`,
				`${TABLE_NAME_INTERVALS}.timerId`
			)
			.where(`${TABLE_NAME_INTERVALS}.synced`, false)
			.andWhere(`${TABLE_NAME_TIMERS}.employeeId`, user.employeeId)
			.andWhere((qb) =>
				qb
					.where(`${TABLE_NAME_TIMERS}.synced`, false)
					.orWhereNull(`${TABLE_NAME_TIMERS}.timelogId`)
			)
			.orderBy(`${TABLE_NAME_TIMERS}.id`, 'asc');

		const intervalIds = timers.map((timer) => timer.intervalId);

		const intervals = await this._provider
			.connection<IntervalTO>(TABLE_NAME_INTERVALS)
			.select('*')
			.whereIn(`${TABLE_NAME_INTERVALS}.id`, intervalIds)
			.andWhere(`${TABLE_NAME_INTERVALS}.synced`, false);

		const uniqueTimers = [
			...new Map(
				this._removeColumn('intervalId', timers).map((timer) => [
					timer.id,
					timer,
				])
			).values(),
		];

		const timersWithIntervals = uniqueTimers.map((timer: TimerTO) => ({
			timer,
			intervals: intervals
				.map((interval: IntervalTO) => ({
					...interval,
					activities: JSON.parse(interval.activities as any),
					screenshots: JSON.parse(interval.screenshots as any),
				}))
				.filter(
					(interval: IntervalTO) => interval.timerId === timer.id
				),
		}));

		return timersWithIntervals;
	}

	private _removeColumn(column: string, arr: any[]): any[] {
		return arr.map(({ [column]: value, ...rest }) => rest);
	}
}
