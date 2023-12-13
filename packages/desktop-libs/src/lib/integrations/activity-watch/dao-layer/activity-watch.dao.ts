import { ActivityWatchEventTableList, IActivityWatchEventService } from '../i-activity-watch-event-service';
import { IDatabaseProvider, IDesktopEvent } from '../../../interfaces';
import { ProviderFactory } from '../../../offline';
import { Knex } from 'knex';
import { ActivityWatchEventType } from '@gauzy/contracts';

export class ActivityWatchDAO implements IActivityWatchEventService {
	protected readonly provider: IDatabaseProvider;

	constructor(
		protected readonly table: ActivityWatchEventTableList,
		protected readonly type: ActivityWatchEventType
	) {
		this.provider = ProviderFactory.instance;
	}

	public async update(timeSlotId: string, eventIds: number[]): Promise<void> {
		await this.provider.connection.transaction(async (trx: Knex.Transaction) => {
			try {
				await trx(this.table).whereIn('eventId', eventIds).update({
					timeSlotId
				});
			} catch (error) {
				await trx.rollback();
				console.log(`ERROR: On table ${this.table}:`, error);
				throw error;
			}
		});
	}

	public async clear(): Promise<void> {
		try {
			await this.provider.connection<IDesktopEvent>(this.table).del();
		} catch (error) {
			console.log(`ERROR: On table ${this.table}:`, error);
			throw error;
		}
	}

	public async save(event: IDesktopEvent): Promise<void> {
		await this.provider.connection.transaction(async (trx: Knex.Transaction) => {
			try {
				await trx(this.table)
					.insert(event)
					.onConflict('eventId')
					.merge(['duration', 'data', 'recordedAt', 'type']);
				await trx.commit();
			} catch (error) {
				await trx.rollback();
				console.log(`ERROR: On table ${this.table}:`, error);
				throw error;
			}
		});
	}

	public async find(option: Partial<IDesktopEvent>): Promise<IDesktopEvent[]> {
		try {
			return this.provider.connection<IDesktopEvent>(this.table).where('type', this.type).andWhere(option);
		} catch (error) {
			console.log(`ERROR: On table ${this.table}:`, error);
			return Promise.resolve([]);
		}
	}
}
