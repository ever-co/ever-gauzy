import { DAO } from 'lib/interfaces/i-dao';
import { ProviderFactory } from '../databases/provider-factory';
import { IntervalTO, TABLE_NAME_INTERVALS } from '../dto/interval.dto';
import { IDatabaseProvider } from 'lib/interfaces/i-database-provider';
import { IntervalTransaction } from '../transactions/interval-transaction';

export class IntervalDAO implements DAO<IntervalTO> {
	private _provider: IDatabaseProvider;
	private _trx: IntervalTransaction;

	constructor() {
		this._provider = new ProviderFactory();
		this._trx = new IntervalTransaction(this._provider);
	}

	public async findAll(): Promise<IntervalTO[]> {
		try {
			return await this._provider.connection<IntervalTO>(
				TABLE_NAME_INTERVALS
			);
		} catch (error) {
			console.log('[dao]: ', 'interval backed up fails : ', error);
			return [];
		}
	}

	public async findAllSynced(isSynced: boolean): Promise<IntervalTO[]> {
		try {
			return await this._provider
				.connection<IntervalTO>(TABLE_NAME_INTERVALS)
				.where('synced', isSynced);
		} catch (error) {
			console.log('[dao]: ', 'interval backed up fails : ', error);
		}
	}

	public async save(value: IntervalTO): Promise<void> {
		await this._trx.create(value);
	}

	public async findOneById(id: number): Promise<IntervalTO> {
		try {
			return await this._provider
				.connection<IntervalTO>(TABLE_NAME_INTERVALS)
				.where('id', id)[0];
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
			return await this._provider
				.connection<IntervalTO>(TABLE_NAME_INTERVALS)
				.where('id', value.id)
				.del();
		} catch (error) {
			console.log('[dao]: ', 'interval deleted fails : ', error);
		}
	}

	public async backedUpNoSynced(
		startAt: Date,
		endAt: Date
	): Promise<IntervalTO[]> {
		try {
            return await this._provider
			.connection<IntervalTO>(TABLE_NAME_INTERVALS)
			.select('*')
			.whereBetween('startAt', [startAt, endAt])
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
}
