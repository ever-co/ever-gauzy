import { KeyResultUpdate } from './keyresult-update.entity';
import { Connection } from 'typeorm';
import { KeyResult } from '../keyresult/keyresult.entity';
import { Tenant } from '../tenant/tenant.entity';
import * as faker from 'faker';
import { KeyResultUpdateStatusEnum, KeyResultTypeEnum } from '@gauzy/models';
import * as moment from 'moment';
import { GoalTimeFrame } from '../goal-time-frame/goal-time-frame.entity';

export const createDefaultKeyResultUpdates = async (
	connection: Connection,
	tenant: Tenant,
	keyResults: KeyResult[] | void
): Promise<KeyResultUpdate[]> => {
	const defaultKeyResultUpdates = [];
	const goalTimeFrames: GoalTimeFrame[] = await connection.manager.find(
		GoalTimeFrame
	);

	if (!keyResults) {
		console.warn(
			'Warning: keyResults not found, DefaultKeyResultUpdates will not be created'
		);
		return;
	}

	keyResults.forEach(async (keyResult) => {
		const numberOfUpdates = faker.random.number({ min: 2, max: 10 });
		for (let i = 0; i < numberOfUpdates; i++) {
			const startDate = goalTimeFrames.find(
				(element) => element.name === keyResult.goal.deadline
			).startDate;
			if (moment().isAfter(startDate)) {
				const keyResultUpdate = new KeyResultUpdate();
				keyResultUpdate.owner = keyResult.owner.id;
				keyResultUpdate.keyResult = keyResult;
				keyResultUpdate.tenant = tenant;
				keyResultUpdate.status = faker.random.arrayElement([
					KeyResultUpdateStatusEnum.NEEDS_ATTENTION,
					KeyResultUpdateStatusEnum.NONE,
					KeyResultUpdateStatusEnum.OFF_TRACK,
					KeyResultUpdateStatusEnum.ON_TRACK,
					KeyResultUpdateStatusEnum.ON_TRACK,
					KeyResultUpdateStatusEnum.ON_TRACK,
					KeyResultUpdateStatusEnum.ON_TRACK
				]);
				keyResultUpdate.update = faker.random.number({
					min: keyResult.initialValue + 1,
					max: keyResult.targetValue
				});

				keyResultUpdate.createdAt = faker.date.between(
					startDate,
					!keyResult.hardDeadline
						? moment().toDate()
						: moment(keyResult.hardDeadline).isBefore(moment())
						? keyResult.hardDeadline
						: moment().toDate()
				);

				if (keyResult.type !== KeyResultTypeEnum.TRUE_OR_FALSE) {
					const diff = keyResult.targetValue - keyResult.initialValue;
					const updateDiff =
						keyResultUpdate.update - keyResult.initialValue;

					keyResultUpdate.progress = Math.round(
						(Math.abs(updateDiff) / Math.abs(diff)) * 100
					);
				} else {
					keyResultUpdate.progress =
						keyResultUpdate.update === 1 ? 100 : 0;
				}

				defaultKeyResultUpdates.push(keyResultUpdate);
			}
		}
	});
	await insertDefaultKeyResultUpdates(connection, defaultKeyResultUpdates);
	return defaultKeyResultUpdates;
};

const insertDefaultKeyResultUpdates = async (
	connection: Connection,
	defaultKeyResultUpdates: KeyResultUpdate[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(KeyResultUpdate)
		.values(defaultKeyResultUpdates)
		.execute();
};
