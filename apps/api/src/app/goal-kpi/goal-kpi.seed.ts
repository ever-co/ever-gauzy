import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import {
	Employee,
	KpiMetricEnum,
	Organization,
	KpiOperatorEnum,
	CurrenciesEnum,
	KeyResultNumberUnitsEnum
} from '@gauzy/models';
import { GoalKPI } from './goal-kpi.entity';
import * as faker from 'faker';

export const createRandomGoalKpi = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	tenantEmployeeMap: Map<Tenant, Employee[]>
): Promise<GoalKPI[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantCandidatesMap not found, Goal Kpi not be created'
		);
		return;
	}

	let GoalKpis: GoalKPI[] = [];

	for (const tenant of tenants) {
		const tenantEOrganization = tenantOrganizationsMap.get(tenant);

		for (const tenantOrg of tenantEOrganization) {
			let tenantEmployee = tenantEmployeeMap.get(tenant);

			for (const employee of tenantEmployee) {
				let goalkpi = new GoalKPI();
				goalkpi.name = faker.name.findName();
				goalkpi.description = faker.name.jobDescriptor();
				goalkpi.type = faker.random.arrayElement(
					Object.values(KpiMetricEnum)
				);
				goalkpi.operator = faker.random.arrayElement(
					Object.values(KpiOperatorEnum)
				);
				if (goalkpi.type === KpiMetricEnum.CURRENCY) {
					goalkpi.unit = faker.random.arrayElement(
						Object.values(CurrenciesEnum)
					);
				} else if (goalkpi.type === KpiMetricEnum.NUMERICAL) {
					goalkpi.unit = faker.random.arrayElement(
						Object.values(KeyResultNumberUnitsEnum)
					);
				}
				goalkpi.lead = employee;
				goalkpi.currentValue = Math.floor(Math.random() * 9999) + 1;
				goalkpi.targetValue =
					Math.floor(
						Math.random() * (99999 - goalkpi.currentValue + 1)
					) + goalkpi.currentValue;
				goalkpi.organization = tenantOrg;
				goalkpi.tenant = tenant;
				GoalKpis.push(goalkpi);
			}
		}
	}
	await insertRandomGoalKpi(connection, GoalKpis);
	return GoalKpis;
};

const insertRandomGoalKpi = async (
	connection: Connection,
	Employees: GoalKPI[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(GoalKPI)
		.values(Employees)
		.execute();
};
