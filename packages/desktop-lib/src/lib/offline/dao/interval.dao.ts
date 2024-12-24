import { DAO, IDatabaseProvider } from '../../interfaces';
import { ProviderFactory } from '../databases';
import { IntervalTO, TABLE_NAME_INTERVALS, UserTO } from '../dto';
import { IntervalTransaction } from '../transactions';

export class IntervalDAO implements DAO<IntervalTO> {
	private _provider: IDatabaseProvider;
	private _trx: IntervalTransaction;
	private _providerFactory = ProviderFactory.instance;

	constructor() {
		this._provider = ProviderFactory.instance;
		this._trx = new IntervalTransaction(this._provider);
	}

	private _isJSON(value: any): boolean {
		try {
			JSON.parse(value);
			return true;
		} catch (error) {
			return false;
		}
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
				.andWhere('isDeleted', false)
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
			return await this._provider
				.connection<IntervalTO>(TABLE_NAME_INTERVALS)
				.where('id', id)
				.andWhere('isDeleted', false)[0];
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
				.where((qb) =>
					qb
						.whereBetween('startedAt', [new Date(startedAt), new Date(stoppedAt)])
						.andWhere('synced', false)
						.andWhere('isDeleted', false)
				);
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
				.where('isDeleted', false)
				.andWhere('synced', isSynced);
		} catch (error) {
			console.log('[dao]: ', 'interval backed up fails : ', error);
		}
	}

	public async screenshots(user: UserTO): Promise<any[]> {
		try {
			const query = (provider: string) => {
				switch (provider) {
					case 'mysql':
						return 'JSON_LENGTH(screenshots) != 0';
					case 'postgres':
						return 'jsonb_array_length(screenshots) != 0';
					default:
						return 'json_array_length(screenshots) != 0';
				}
			};
			const latests = await this._provider
				.connection<IntervalTO>(TABLE_NAME_INTERVALS)
				.select('id', 'screenshots', 'startedAt as recordedAt')
				.where('employeeId', user.employeeId)
				.where('isDeleted', false)
				.andWhere((qb) => qb.whereNot('screenshots', '[]').orWhereRaw(query(this._providerFactory.dialect)))
				.orderBy('id', 'desc')
				.limit(10);
			return latests.map((latest) => {
				return {
					...latest,
					screenshots: this._isJSON(latest.screenshots) ? JSON.parse(latest.screenshots) : latest.screenshots
				};
			});
		} catch (error) {
			console.error('[SCREENSHOT_DAO_ERROR]', error);
		}
	}

	/**
	 * It deletes all the intervals that are not synced and then returns the remoteIds of the intervals
	 * that are synced
	 * @param {Date} startedAt - Date,
	 * @param {Date} stoppedAt - Date,
	 * @param {UserTO} user - UserTO
	 * @returns The remoteId of the intervals that are synced and not null.
	 */
	public async deleteIdlesTime(
		startedAt: Date,
		stoppedAt: Date,
		user: UserTO
	): Promise<Pick<IntervalTO, 'remoteId'>[]> {
		try {
			const remotesIds = await this._provider
				.connection<IntervalTO>(TABLE_NAME_INTERVALS)
				.select('remoteId')
				.where('employeeId', user.employeeId)
				.where('isDeleted', false)
				.where((qb) => qb.whereBetween('stoppedAt', [new Date(startedAt), new Date(stoppedAt)]));
			await this.deleteByRemoteId(...remotesIds.map(({ remoteId }) => remoteId));
			return remotesIds;
		} catch (error) {
			console.log('[dao]: ', error);
		}
	}

	/**
	 * It soft deletes all the intervals that are not synced and that are between the given dates
	 * @param {Date} startedAt - Date,
	 * @param {Date} stoppedAt - Date - the date when the user stopped working
	 * @param {UserTO} user - UserTO
	 */
	public async deleteLocallyIdlesTime(startedAt: Date, stoppedAt: Date, user: UserTO): Promise<void> {
		try {
			await this._provider
				.connection<IntervalTO>(TABLE_NAME_INTERVALS)
				.where('employeeId', user.employeeId)
				.whereBetween('stoppedAt', [new Date(startedAt), new Date(stoppedAt)])
				.update({ isDeleted: true, synced: true });
		} catch (error) {
			console.log('[dao]: ', error);
		}
	}

	public async deleteByRemoteId(...remoteIds: string[]): Promise<void> {
		try {
			return await this._provider
				.connection<IntervalTO>(TABLE_NAME_INTERVALS)
				.whereIn('remoteId', remoteIds)
				.update({ isDeleted: true, synced: true });
		} catch (error) {
			console.log('[dao]: ', 'interval deleted fails : ', error);
		}
	}

	public async lastSyncedInterval(employeeId: string, excludeIds: string[]): Promise<IntervalTO> {
		return this._provider
			.connection<IntervalTO>(TABLE_NAME_INTERVALS)
			.where('employeeId', employeeId)
			.whereNotIn('remoteId', excludeIds)
			.where((builder) => {
				builder.whereNotNull('remoteId').andWhere('synced', true).andWhere('isDeleted', false);
			})
			.orderBy('id', 'desc')
			.first();
	}
}
