import { Connection } from 'typeorm';
import * as faker from 'faker';
import { KeyResult } from './keyresult.entity';
import {
	IEmployee,
	ITenant,
	KeyResultDeadlineEnum,
	KeyResultTypeEnum,
	KeyResultWeightEnum
} from '@gauzy/contracts';
import { KeyResultUpdate } from '../keyresult-update/keyresult-update.entity';
import { compareAsc } from 'date-fns';
import * as moment from 'moment';
import { GoalKPI } from '../goal-kpi/goal-kpi.entity';
import { DEFAULT_KEY_RESULTS } from './default-keyresults';

export const createDefaultKeyResults = async (
	connection: Connection,
	tenant: ITenant,
	employees: IEmployee[],
	goals
): Promise<KeyResult[]> => {
	const defaultKeyResults = [];
	const goalKPIs: GoalKPI[] = await connection.manager.find(GoalKPI);
	if (goals && goals.length > 0) {
		goals.forEach((goal) => {
			const keyResultsOfGoal = DEFAULT_KEY_RESULTS.find(
				(goalData) => goalData.name === goal.name
			);
			keyResultsOfGoal.keyResults.forEach((keyResultData) => {
				const keyResult = new KeyResult();
				keyResult.deadline = keyResultData.deadline;
				if (
					keyResult.deadline !==
					KeyResultDeadlineEnum.NO_CUSTOM_DEADLINE
				) {
					keyResult.hardDeadline = keyResultData.hardDeadline;
					keyResult.softDeadline = null;
					if (
						keyResult.deadline ===
						KeyResultDeadlineEnum.HARD_AND_SOFT_DEADLINE
					) {
						keyResult.softDeadline = keyResultData.softDeadline;
					}
				} else {
					keyResult.hardDeadline = null;
					keyResult.softDeadline = null;
				}
				keyResult.owner = faker.random.arrayElement(employees);
				keyResult.lead = faker.random.arrayElement(employees);
				keyResult.type = keyResultData.type;

				if (keyResult.type === KeyResultTypeEnum.TRUE_OR_FALSE) {
					keyResult.initialValue = 0;
					keyResult.targetValue = 1;
				} else {
					if (keyResultData.type === KeyResultTypeEnum.KPI) {
						keyResult.kpi = faker.random.arrayElement(goalKPIs);
					}
					keyResult.initialValue = keyResultData.initialValue;
					keyResult.targetValue = keyResultData.targetValue;
				}

				keyResult.unit = keyResultData.unit;

				keyResult.progress = 0;
				keyResult.name = keyResultData.name;
				keyResult.goal = goal;
				keyResult.organizationId = goal.organizationId;
				keyResult.tenant = tenant;
				keyResult.update = keyResult.initialValue;
				keyResult.status = 'none';
				keyResult.description = ' ';
				keyResult.weight = faker.random.arrayElement([
					KeyResultWeightEnum.DEFAULT,
					KeyResultWeightEnum.INCREASE_BY_2X,
					KeyResultWeightEnum.INCREASE_BY_4X
				]);
				defaultKeyResults.push(keyResult);
			});
		});

		await insertDefaultKeyResults(connection, defaultKeyResults);

		return defaultKeyResults;
	}
};

export const updateDefaultKeyResultProgress = async (
	connection: Connection
): Promise<KeyResult[]> => {
	const keyResults: KeyResult[] = await connection.manager.find(KeyResult, {
		relations: ['updates']
	});
	keyResults.forEach(async (keyResult) => {
		const sortedUpdates: KeyResultUpdate[] = [...keyResult.updates].sort(
			(a, b) => {
				return compareAsc(new Date(a.createdAt), new Date(b.createdAt));
			}
		);
		const recentUpdate = sortedUpdates[sortedUpdates.length - 1];
		if (recentUpdate) {
			await connection.manager.update(
				KeyResult,
				{ id: keyResult.id },
				{
					progress: recentUpdate.progress,
					update: recentUpdate.update
				}
			);
		}
	});
	return keyResults;
};

const insertDefaultKeyResults = async (
	connection: Connection,
	defaultKeyResults: KeyResult[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(KeyResult)
		.values(defaultKeyResults)
		.execute();
};

export const createRandomKeyResult = async (
	connection: Connection,
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>,
	goals
): Promise<KeyResult[]> => {
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantEmployeeMap not found, Random KeyResult will not be created'
		);
		return;
	}

	const keyResults: KeyResult[] = [];

	for (const tenant of tenants) {
		const tenantEmployees = tenantEmployeeMap.get(tenant);
		for (const goal of goals) {
			const keyResult = new KeyResult();

			keyResult.deadline = faker.random.arrayElement(
				Object.keys(KeyResultDeadlineEnum)
			);
			if (
				keyResult.deadline !== KeyResultDeadlineEnum.NO_CUSTOM_DEADLINE
			) {
				keyResult.hardDeadline = moment(new Date())
					.add(1, 'days')
					.toDate();
				keyResult.softDeadline = null;
				if (
					keyResult.deadline ===
					KeyResultDeadlineEnum.HARD_AND_SOFT_DEADLINE
				) {
					keyResult.softDeadline = moment(new Date())
						.add(3, 'days')
						.toDate();
				}
			} else {
				keyResult.hardDeadline = null;
				keyResult.softDeadline = null;
			}
			keyResult.owner = faker.random.arrayElement(tenantEmployees);
			keyResult.lead = faker.random.arrayElement(tenantEmployees);
			keyResult.type = faker.random.arrayElement(
				Object.keys(KeyResultTypeEnum)
			);

			if (keyResult.type === KeyResultTypeEnum.TRUE_OR_FALSE) {
				keyResult.initialValue = 0;
				keyResult.targetValue = 1;
			} else {
				keyResult.targetValue = faker.datatype.number(5000);
				keyResult.initialValue = faker.datatype.number(
					keyResult.targetValue
				);
			}

			keyResult.unit = faker.random.arrayElement([
				'signups',
				'publications',
				'interviews',
				'people',
				'%'
			]);

			keyResult.progress = 0;
			keyResult.name = faker.name.jobTitle();
			keyResult.goal = goal;
			keyResult.organizationId = goal.organizationId;
			keyResult.tenant = tenant;
			keyResult.update = keyResult.initialValue;
			keyResult.status = 'none';
			keyResult.description = ' ';
			keyResult.weight = faker.random.arrayElement([
				KeyResultWeightEnum.DEFAULT,
				KeyResultWeightEnum.INCREASE_BY_2X,
				KeyResultWeightEnum.INCREASE_BY_4X
			]);

			keyResults.push(keyResult);
		}
	}
	await connection.manager.save(keyResults);
};
