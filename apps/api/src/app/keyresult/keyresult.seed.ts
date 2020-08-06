import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Employee } from '../employee/employee.entity';
import * as faker from 'faker';
import { KeyResult } from './keyresult.entity';
import {
	KeyResultDeadlineEnum,
	KeyResultTypeEnum,
	KeyResultWeightEnum
} from '@gauzy/models';
import { KeyResultUpdate } from '../keyresult-update/keyresult-update.entity';
import { compareAsc } from 'date-fns';
import { Organization } from '../organization/organization.entity';
import * as moment from 'moment';

const keyResultDefaultData = [
	{
		id: 'fb87b179-e5d1-4cc4-8ad0-a91624e6f2fc',
		name: 'Improve product performance',
		level: 'Organization',
		keyResults: [
			{
				name: 'Get over 10000 new signups',
				type: 'Numerical',
				targetValue: 10000,
				initialValue: 0,
				unit: 'signups',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null,
				goalId: 'fb87b179-e5d1-4cc4-8ad0-a91624e6f2fc'
			},
			{
				name: 'Publish product reviews in over 50 publications',
				type: 'Numerical',
				targetValue: 50,
				initialValue: 0,
				unit: 'publications',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null,
				goalId: 'fb87b179-e5d1-4cc4-8ad0-a91624e6f2fc'
			}
		]
	},
	{
		id: 'c8cc1495-668a-4930-8b54-735fca9028e9',
		name: 'Successfully launch version 2 of our main product',
		level: 'Organization',
		keyResults: [
			{
				name:
					'Reduce the average response time on the app to less than 500ms',
				type: 'KPI',
				targetValue: 500,
				initialValue: 1000,
				unit: '',
				kpiId: 'a77d9bd8-0baa-4548-b153-e9f2bae51760',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null,
				goalId: 'c8cc1495-668a-4930-8b54-735fca9028e9'
			}
		]
	},
	{
		id: '08e93b16-0ea1-49f9-8e66-f30a86eea660',
		name: 'Redesign and launch our new landing page',
		level: 'Team',
		keyResults: [
			{
				name:
					'Design new version of our site structure, navigation and all pages',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null,
				goalId: '08e93b16-0ea1-49f9-8e66-f30a86eea660'
			},
			{
				name:
					'Conduct stakeholder interviews with 10 people from sales and marketing',
				type: 'Numerical',
				targetValue: 10,
				initialValue: 0,
				unit: 'interviews',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null,
				goalId: '08e93b16-0ea1-49f9-8e66-f30a86eea660'
			},
			{
				name: 'With development and marketing, launch by September 1st',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'Hard Deadline',
				hardDeadline: '2020-08-31T18:30:00.000Z',
				softDeadline: null,
				goalId: '08e93b16-0ea1-49f9-8e66-f30a86eea660'
			},
			{
				name: 'User-test page prototypes on 10 people',
				type: 'Numerical',
				targetValue: 10,
				initialValue: 0,
				unit: 'people',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null,
				goalId: '08e93b16-0ea1-49f9-8e66-f30a86eea660'
			},
			{
				name:
					'Test existing landing page and sub-pages on external users for understanding issues',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null,
				goalId: '08e93b16-0ea1-49f9-8e66-f30a86eea660'
			}
		]
	},
	{
		id: '096e4b97-c13c-469f-bb66-5e347b8861fa',
		name: 'Increase quality of releases and make sure they are timely',
		level: 'Team',
		keyResults: [
			{
				name:
					'Reduce the number of priority bugs found in production to be less than 2',
				type: 'KPI',
				targetValue: 2,
				initialValue: 15,
				unit: '',
				kpiId: '85f89379-f181-4f72-b722-d924df63c7ea',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null,
				goalId: '096e4b97-c13c-469f-bb66-5e347b8861fa'
			},
			{
				name: 'Increase unit test coverage to 75% from current 45%',
				type: 'Numerical',
				targetValue: 45,
				initialValue: 75,
				unit: '%',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null,
				goalId: '096e4b97-c13c-469f-bb66-5e347b8861fa'
			}
		]
	},
	{
		id: '1c63dfca-fdf9-41c6-9b65-d434aeb1c179',
		name: 'Identify problems with current user interface',
		level: 'Employee',
		keyResults: [
			{
				name: 'Learn new skills to enhance creativity',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null,
				goalId: '1c63dfca-fdf9-41c6-9b65-d434aeb1c179'
			},
			{
				name: 'Provide solution to reduce time Lag by 85%',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null,
				goalId: '1c63dfca-fdf9-41c6-9b65-d434aeb1c179'
			},
			{
				name:
					'Identify areas where the product lags in more than 20% cases',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null,
				goalId: '1c63dfca-fdf9-41c6-9b65-d434aeb1c179'
			},
			{
				name: 'Test all features in real time',
				description: '',
				type: 'True/False',
				targetValue: 1,
				initialValue: 0,
				unit: '',
				deadline: 'No Custom Deadline',
				hardDeadline: null,
				softDeadline: null,
				goalId: '1c63dfca-fdf9-41c6-9b65-d434aeb1c179'
			}
		]
	}
];

export const createDefaultKeyResults = async (
	connection: Connection,
	tenant: Tenant,
	employees: Employee[],
	goals
): Promise<KeyResult[]> => {
	const defaultKeyResults = [];
	if (goals && goals.length > 0) {
		goals.forEach((goal) => {
			const keyResultsOfGoal = keyResultDefaultData.find(
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
					keyResult.initialValue = keyResultData.initialValue;
					keyResult.targetValue = keyResultData.targetValue;
				}

				keyResult.unit = keyResultData.unit;

				keyResult.progress = 0;
				keyResult.name = keyResultData.name;
				keyResult.goal = goal;
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
	defaultkeyResults: KeyResult[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(KeyResult)
		.values(defaultkeyResults)
		.execute();
};

export const createRandomKeyResult = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, Employee[]>,
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
					keyResult.deadline !==
					KeyResultDeadlineEnum.NO_CUSTOM_DEADLINE
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
					keyResult.targetValue = faker.random.number(5000);
					keyResult.initialValue = faker.random.number(
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
