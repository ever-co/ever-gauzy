import { Connection } from 'typeorm';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import {
	CurrenciesEnum,
	Organization,
	RecurringExpenseDefaultCategoriesEnum
} from '@gauzy/models';
import * as moment from 'moment';
import * as _ from 'underscore';

export const createRandomOrganizationRecurringExpense = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<OrganizationRecurringExpense[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, organization language not be created'
		);
		return;
	}

	let mapOrganizationRecurringExpense: OrganizationRecurringExpense[] = [];
	let expenseCategories = Object.keys(RecurringExpenseDefaultCategoriesEnum);
	let currency = Object.keys(CurrenciesEnum);

	for (const tenant of tenants) {
		let tenantOrganization = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrganization) {
			for (const expenseCategory of expenseCategories) {
				let organization = new OrganizationRecurringExpense();

				let startDate = faker.date.past();
				let endDate = moment(startDate).add(1, 'months').toDate();

				organization.organization = tenantOrg;
				organization.organizationId = tenantOrg.id;

				organization.startDay = startDate.getDate();
				organization.startMonth = startDate.getMonth() + 1;
				organization.startYear = startDate.getFullYear();
				organization.startDate = startDate;

				organization.endDay = endDate.getDate();
				organization.endMonth = endDate.getMonth();
				organization.endYear = endDate.getFullYear();
				organization.endDate = endDate;

				organization.categoryName = expenseCategory;
				organization.value = faker.random.number(9999);

				organization.currency =
					CurrenciesEnum[currency[faker.random.number(2)]];

				mapOrganizationRecurringExpense.push(organization);
			}
		}
	}

	await insertRandomOrganizationRecurringExpense(
		connection,
		mapOrganizationRecurringExpense
	);
	return mapOrganizationRecurringExpense;
};

const insertRandomOrganizationRecurringExpense = async (
	connection: Connection,
	data: OrganizationRecurringExpense[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(OrganizationRecurringExpense)
		.values(data)
		.execute();
};
