import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { KeyResult } from './keyresult.entity';
import {
	IEmployee,
	IOrganization,
	ITenant,
	KeyResultDeadlineEnum,
	KeyResultTypeEnum,
	KeyResultWeightEnum
} from '@gauzy/contracts';
import { KeyResultUpdate } from '../keyresult-update/keyresult-update.entity';
import { compareAsc } from 'date-fns';
import moment from 'moment';
import { GoalKPI } from '../goal-kpi/goal-kpi.entity';
import { DEFAULT_KEY_RESULTS } from './default-keyresults';

export const createDefaultKeyResults = async (
	dataSource: DataSource,
	tenant: ITenant,
	employees: IEmployee[],
	goals
): Promise<KeyResult[]> => {
	const defaultKeyResults = [];
	const goalKPIs: GoalKPI[] = await dataSource.manager.find(GoalKPI);
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
				keyResult.owner = faker.helpers.arrayElement(employees);
				keyResult.lead = faker.helpers.arrayElement(employees);
				keyResult.type = keyResultData.type;

				if (keyResult.type === KeyResultTypeEnum.TRUE_OR_FALSE) {
					keyResult.initialValue = 0;
					keyResult.targetValue = 1;
				} else {
					if (keyResultData.type === KeyResultTypeEnum.KPI) {
						keyResult.kpi = faker.helpers.arrayElement(goalKPIs);
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
				keyResult.weight = faker.helpers.arrayElement([
					KeyResultWeightEnum.DEFAULT,
					KeyResultWeightEnum.INCREASE_BY_2X,
					KeyResultWeightEnum.INCREASE_BY_4X
				]);
				defaultKeyResults.push(keyResult);
			});
		});

		await insertDefaultKeyResults(dataSource, defaultKeyResults);

		return defaultKeyResults;
	}
};

export const updateDefaultKeyResultProgress = async (
	dataSource: DataSource
): Promise<KeyResult[]> => {
	const keyResults: KeyResult[] = await dataSource.manager.find(KeyResult, {
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
			await dataSource.manager.update(
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
	dataSource: DataSource,
	defaultKeyResults: KeyResult[]
) => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(KeyResult)
		.values(defaultKeyResults)
		.execute();
};

export const createRandomKeyResult = async (
	dataSource: DataSource,
	tenants: ITenant[],
	goals: any,
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>,
): Promise<KeyResult[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Random KeyResult will not be created'
		);
		return;
	}
	if (!organizationEmployeesMap) {
		console.warn(
			'Warning: organizationEmployeesMap not found, Random KeyResult will not be created'
		);
		return;
	}

	const keyResults: KeyResult[] = [];

	for (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for await (const organization of tenantOrgs) {
			const organizationEmployees = organizationEmployeesMap.get(organization);
			for (const goal of goals) {
				const keyResult = new KeyResult();

				keyResult.deadline = faker.helpers.arrayElement(
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
				keyResult.owner = faker.helpers.arrayElement(organizationEmployees);
				keyResult.lead = faker.helpers.arrayElement(organizationEmployees);
				keyResult.type = faker.helpers.arrayElement(
					Object.keys(KeyResultTypeEnum)
				);

				if (keyResult.type === KeyResultTypeEnum.TRUE_OR_FALSE) {
					keyResult.initialValue = 0;
					keyResult.targetValue = 1;
				} else {
					keyResult.targetValue = faker.number.int(5000);
					keyResult.initialValue = faker.number.int(
						keyResult.targetValue
					);
				}

				keyResult.unit = faker.helpers.arrayElement([
					'signups',
					'publications',
					'interviews',
					'people',
					'%'
				]);

				keyResult.progress = 0;
				keyResult.name = faker.person.jobTitle();
				keyResult.goal = goal;
				keyResult.organizationId = goal.organizationId;
				keyResult.tenant = tenant;
				keyResult.update = keyResult.initialValue;
				keyResult.status = 'none';
				keyResult.description = ' ';
				keyResult.weight = faker.helpers.arrayElement([
					KeyResultWeightEnum.DEFAULT,
					KeyResultWeightEnum.INCREASE_BY_2X,
					KeyResultWeightEnum.INCREASE_BY_4X
				]);

				keyResults.push(keyResult);
			}
		}
	}
	await dataSource.manager.save(keyResults);
};
