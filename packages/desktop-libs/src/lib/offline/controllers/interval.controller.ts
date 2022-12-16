import { IIntervalController } from 'lib/interfaces/i-interval-controller';
import { IInterval, TABLE_NAME_INTERVAL } from '../models/interval.model';
import Knex from 'knex';

export class IntervalController implements IIntervalController<IInterval> {
	public async create(interval: IInterval): Promise<void> {
		await Knex<IInterval>(TABLE_NAME_INTERVAL).insert(interval);
	}

	public async backedUpNoSynced(): Promise<IInterval[]> {
		return await Knex<IInterval>(TABLE_NAME_INTERVAL).where(
			'synced',
			false
		);
	}

	public async destroy(interval: Partial<IInterval>): Promise<void> {
		await Knex<IInterval>(TABLE_NAME_INTERVAL).where('id', interval.id);
	}

	public async remove(interval: Partial<IInterval>): Promise<void> {
		await Knex<IInterval>(TABLE_NAME_INTERVAL)
			.where('id', interval.id)
			.delete();
	}

	public async findBetweenTwoDates(
		startAt: Date,
		endAt: Date
	): Promise<IInterval[]> {
		return await Knex<IInterval>(TABLE_NAME_INTERVAL)
			.select('*')
			.where('startAt', '>', startAt)
			.andWhere('endAt', '<', endAt);
	}

	private async _insertionTrx(interval: IInterval): Promise<void> {
		// await Knex(TABLE_NAME_INTERVAL)
		// 	.transaction(function (trx) {
		// 		Knex(TABLE_NAME_INTERVAL)
		// 			.transacting(trx)
		// 			.insert(interval)
		// 			.then(function (resp) {
		// 				const id = resp[0];
		// 				return someExternalMethod(id, trx);
		// 			})
		// 			.then(trx.commit)
		// 			.catch(trx.rollback);
		// 	})
		// 	.then(function (resp) {
		// 		console.log('Transaction complete.');
		// 	})
		// 	.catch(function (err) {
		// 		console.error(err);
		// 	});
	}
}
