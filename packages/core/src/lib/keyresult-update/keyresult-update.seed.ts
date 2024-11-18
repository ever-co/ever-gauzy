import { KeyResultUpdate } from './keyresult-update.entity';
import { DataSource } from 'typeorm';
import { KeyResult } from '../keyresult/keyresult.entity';
import { faker } from '@faker-js/faker';
import {
	KeyResultUpdateStatusEnum,
	KeyResultTypeEnum,
	IOrganization,
	ITenant
} from '@gauzy/contracts';
import moment from 'moment';
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

	for await (const keyResult of keyResults) {
		const { initialValue, targetValue } = keyResult;

		const numberOfUpdates = faker.number.int({ min: 2, max: 10 });
		for (let i = 0; i < numberOfUpdates; i++) {
			const startDate = goalTimeFrames.find((element) => element.name === keyResult.goal.deadline).startDate;
			if (moment().isAfter(startDate)) {
				const keyResultUpdate = new KeyResultUpdate();
				keyResultUpdate.owner = keyResult.owner.id;
				keyResultUpdate.keyResultId = keyResult.id;
				keyResultUpdate.tenant = tenant;
				keyResultUpdate.organization = organization;
				keyResultUpdate.status = faker.helpers.arrayElement(
					Object.values(KeyResultUpdateStatusEnum)
				);

				let max: number, min: number = 0;
				if (initialValue > targetValue) {
					max = initialValue;
					min = targetValue;
				} else {
					max = targetValue;
					min = initialValue;
				}

				keyResultUpdate.update = faker.number.int({ min, max });
				if (keyResult.type !== KeyResultTypeEnum.TRUE_OR_FALSE) {
					const diff = keyResult.targetValue - keyResult.initialValue;
					const updateDiff = keyResultUpdate.update - keyResult.initialValue;

					keyResultUpdate.progress = Math.round(
						(Math.abs(updateDiff) / Math.abs(diff)) * 100
					);
				} else {
					keyResultUpdate.progress = keyResultUpdate.update == 1 ? 100 : 0;
				}
				defaultKeyResultUpdates.push(keyResultUpdate);
			}
		}
	}

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
