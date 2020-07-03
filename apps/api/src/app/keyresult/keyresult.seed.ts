import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Employee } from '../employee/employee.entity';
import * as faker from 'faker';
import * as moment from 'moment';
import { KeyResult } from './keyresult.entity';
import { KeyResultDeadlineEnum, KeyResultTypeEnum } from '@gauzy/models';
import { GoalTimeFrame } from '../goal-time-frame/goal-time-frame.entity';

export const createKeyResults = async (
	connection: Connection,
	tenant: Tenant,
	employees: Employee[],
	goals
): Promise<KeyResult[]> => {
	const defaultKeyResults = [];
	const goalTimeFrames: GoalTimeFrame[] = await connection.manager.find(
		GoalTimeFrame
	);

	goals.forEach((goal) => {
		for (let i = 0; i < faker.random.number({ min: 2, max: 5 }); i++) {
			const endDate = goalTimeFrames.find(
				(element) => element.name === goal.deadline
			).endDate;
			const keyResult = new KeyResult();
			keyResult.deadline = faker.random.arrayElement([
				KeyResultDeadlineEnum.HARD_AND_SOFT_DEADLINE,
				KeyResultDeadlineEnum.HARD_DEADLINE,
				KeyResultDeadlineEnum.NO_CUSTOM_DEADLINE
			]);
			if (
				keyResult.deadline !== KeyResultDeadlineEnum.NO_CUSTOM_DEADLINE
			) {
				keyResult.hardDeadline = moment(endDate)
					.subtract(2, 'weeks')
					.toDate();
				keyResult.softDeadline = null;
				if (
					keyResult.deadline ===
					KeyResultDeadlineEnum.HARD_AND_SOFT_DEADLINE
				) {
					keyResult.softDeadline = moment(endDate)
						.subtract(1, 'month')
						.toDate();
				}
			} else {
				keyResult.hardDeadline = null;
				keyResult.softDeadline = null;
			}
			keyResult.owner = faker.random.arrayElement(employees);
			keyResult.lead = faker.random.arrayElement(employees);
			keyResult.type = faker.random.arrayElement([
				KeyResultTypeEnum.CURRENCY,
				KeyResultTypeEnum.NUMBER,
				KeyResultTypeEnum.TRUE_OR_FALSE
			]);

			if (keyResult.type === KeyResultTypeEnum.TRUE_OR_FALSE) {
				keyResult.initialValue = 0;
				keyResult.targetValue = 1;
			} else {
				keyResult.initialValue = faker.random.number({
					min: 0,
					max: 10
				});
				keyResult.targetValue = faker.random.number({
					min: 150,
					max: 500
				});
			}
			keyResult.progress = 0;
			keyResult.name = `Keyresult-${keyResult.type}-${keyResult.deadline}`;
			keyResult.goal = goal;
			keyResult.tenant = tenant;
			keyResult.update = keyResult.initialValue;
			keyResult.status = 'none';
			keyResult.description = ' ';
			defaultKeyResults.push(keyResult);
		}
	});

	await insertKeyResults(connection, defaultKeyResults);

	return defaultKeyResults;
};

const insertKeyResults = async (
	connection: Connection,
	defaultkeyResult: KeyResult[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(KeyResult)
		.values(defaultkeyResult)
		.execute();
};
