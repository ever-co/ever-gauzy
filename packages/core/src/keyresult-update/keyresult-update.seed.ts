import { KeyResultUpdate } from './keyresult-update.entity';
import { DataSource } from 'typeorm';
import { KeyResult } from '../keyresult/keyresult.entity';
import { faker } from '@ever-co/faker';
import {
	KeyResultUpdateStatusEnum,
	KeyResultTypeEnum,
	KeyResultDeadlineEnum,
	IOrganization,
	ITenant
} from '@gauzy/contracts';
import * as moment from 'moment';
import { GoalTimeFrame } from '../goal-time-frame/goal-time-frame.entity';

export const createDefaultKeyResultUpdates = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	keyResults: KeyResult[] | void
): Promise<KeyResultUpdate[]> => {
	const defaultKeyResultUpdates = [];
	const goalTimeFrames: GoalTimeFrame[] = await dataSource.manager.find(
		GoalTimeFrame
	);

	if (!keyResults) {
		console.warn(
			'Warning: keyResults not found, DefaultKeyResultUpdates will not be created'
		);
		return;
	}
	keyResults.forEach(async (keyResult) => {
		const numberOfUpdates = faker.datatype.number({ min: 2, max: 10 });
		for (let i = 0; i < numberOfUpdates; i++) {
			const startDate = goalTimeFrames.find(
				(element) => element.name === keyResult.goal.deadline
			).startDate;
			const endDate = goalTimeFrames.find(
				(element) => element.name === keyResult.goal.deadline
			).endDate;
			if (moment().isAfter(startDate)) {
				const keyResultUpdate = new KeyResultUpdate();
				keyResultUpdate.owner = keyResult.owner.id;
				keyResultUpdate.keyResult = keyResult;
				keyResultUpdate.tenant = tenant;
				keyResultUpdate.organization = organization;
				keyResultUpdate.status = faker.random.arrayElement(
					Object.values(KeyResultUpdateStatusEnum)
				);
				keyResultUpdate.update = faker.datatype.number({
					min: keyResult.initialValue + 1,
					max: keyResult.targetValue
				});
				if (
					keyResult.deadline ===
					KeyResultDeadlineEnum.NO_CUSTOM_DEADLINE
				) {
					keyResultUpdate.createdAt = faker.date.between(
						startDate,
						endDate
					);
				} else {
					keyResultUpdate.createdAt = faker.date.between(
						startDate,
						keyResult.hardDeadline
					);
				}

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

	return await insertDefaultKeyResultUpdates(
		dataSource,
		defaultKeyResultUpdates
	);
};

const insertDefaultKeyResultUpdates = async (
	dataSource: DataSource,
	defaultKeyResultUpdates: KeyResultUpdate[]
): Promise<KeyResultUpdate[]> => {
	return await dataSource.manager.save(defaultKeyResultUpdates);
};
