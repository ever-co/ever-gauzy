import { DAO, IDatabaseProvider } from '../../interfaces';
import { ProviderFactory } from '../databases';
import { IntervalTO, TABLE_NAME_INTERVALS, UserTO } from '../dto';
import { IntervalTransaction } from '../transactions';

export class IntervalDAO implements DAO<IntervalTO> {
	private _provider: IDatabaseProvider;
	private _trx: IntervalTransaction;

	constructor() {
		this._provider = ProviderFactory.instance;
		this._trx = new IntervalTransaction(this._provider);
	}

	public async findAll(): Promise<IntervalTO[]> {
		try {
			return await this._provider.connection<IntervalTO>(TABLE_NAME_INTERVALS);
		} catch (error) {
			console.log('[dao]: ', 'interval backed up fails : ', error);
			return [];
		}
	}

	public async findAllSynced(isSynced: boolean, user: UserTO): Promise<IntervalTO[]> {
		try {
			return await this._provider
				.connection<IntervalTO>(TABLE_NAME_INTERVALS)
				.where('employeeId', user.employeeId)
				.andWhere('synced', isSynced);
		} catch (error) {
			console.log('[dao]: ', 'interval backed up fails : ', error);
		}
	}

	public async save(value: IntervalTO): Promise<void> {
		await this._trx.create(value);
	}

	public async findOneById(id: number): Promise<IntervalTO> {
		try {
			return await this._provider.connection<IntervalTO>(TABLE_NAME_INTERVALS).where('id', id)[0];
		} catch (error) {
			console.log('[dao]: ', 'fail on find interval : ', error);
		}
	}

	public async update(id: number, value: IntervalTO): Promise<void> {
		try {
			await this._trx.update(id, value);
		} catch (error) {
			console.log('[dao]: ', 'fail on find interval : ', error);
		}
	}

	public async delete(value: Partial<IntervalTO>): Promise<void> {
		try {
			return await this._provider.connection<IntervalTO>(TABLE_NAME_INTERVALS).where('id', value.id).del();
		} catch (error) {
			console.log('[dao]: ', 'interval deleted fails : ', error);
		}
	}

	public async backedUpNoSynced(startedAt: Date, stoppedAt: Date, user: UserTO): Promise<IntervalTO[]> {
		try {
			return await this._provider
				.connection<IntervalTO>(TABLE_NAME_INTERVALS)
				.select('*')
				.where('employeeId', user.employeeId)
				.andWhereBetween('startedAt', [startedAt, stoppedAt])
				.andWhere('synced', false);
		} catch (error) {
			console.log('[dao]: ', 'interval backup fails : ', error);
		}
	}

	public async synced(offlineStart: Date, offlineEnd: Date): Promise<void> {
		try {
			await this._trx.synced(offlineStart, offlineEnd);
		} catch (error) {
			console.log('[dao]: ', 'interval sync fails : ', error);
		}
	}

	public async count(isSynced: boolean, user: UserTO): Promise<any> {
		try {
			return await this._provider
				.connection<IntervalTO>(TABLE_NAME_INTERVALS)
				.count('* as total')
				.where('employeeId', user.employeeId)
				.andWhere('synced', isSynced);
		} catch (error) {
			console.log('[dao]: ', 'interval backed up fails : ', error);
		}
	}

	public async screenshots(user: UserTO): Promise<any[]> {
		try {
			const latests = await this._provider
				.connection<IntervalTO>(TABLE_NAME_INTERVALS)
				.select('screenshots', 'createdAt as recordedAt')
				.where('employeeId', user.employeeId)
				.orderBy('id', 'desc')
				.limit(10);
			return latests.map((latest) => {
				return {
					...latest,
					screenshots: JSON.parse(latest.screenshots)
				};
			});
		} catch (error) {
			console.error('[SCREENSHOTDAOERROR]', error);
		}
	}
}
