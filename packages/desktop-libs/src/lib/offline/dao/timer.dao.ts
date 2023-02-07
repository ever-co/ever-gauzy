import { ProviderFactory } from '../databases';
import { DAO, ITimerTransaction, IDatabaseProvider } from '../../interfaces';
import { TABLE_NAME_TIMERS, TimerTO, UserTO } from '../dto';
import { TimerTransaction } from '../transactions';

export class TimerDAO implements DAO<TimerTO> {
	private _trx: ITimerTransaction;
	private _provider: IDatabaseProvider;

	constructor() {
		this._provider = ProviderFactory.instance;
		this._trx = new TimerTransaction(this._provider);
	}
	public async findAll(): Promise<TimerTO[]> {
		return await this._provider.connection<TimerTO>(TABLE_NAME_TIMERS).select('*');
	}
	public async save(value: TimerTO): Promise<void> {
		await this._trx.create(value);
	}
	public async findOneById(id: number): Promise<TimerTO> {
		const [timer] = await this._provider.connection<TimerTO>(TABLE_NAME_TIMERS).select('*').where('id', '=', id);
		return timer;
	}
	public async update(id: number, value: Partial<TimerTO>): Promise<void> {
		await this._trx.update(id, value);
	}
	public async delete(value: Partial<TimerTO>): Promise<void> {
		await this._provider.connection<TimerTO>(TABLE_NAME_TIMERS).where('id', '=', value.id).del();
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

	public async findAllNoSynced(user: UserTO): Promise<TimerTO[]> {
		return await this._provider
			.connection<TimerTO>(TABLE_NAME_TIMERS)
			.where('employeeId', user.employeeId)
			.andWhere('synced', false)
			.orderBy('id', 'asc');
	}
}
