import { DataSource } from 'typeorm';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import { faker } from '@faker-js/faker';
import {
	IOrganization,
	ITenant,
	RecurringExpenseDefaultCategoriesEnum
} from '@gauzy/contracts';
import moment from 'moment';
import { environment as env } from '@gauzy/config';

export const createDefaultOrganizationRecurringExpense = async (
	dataSource: DataSource,
	tenant: ITenant,
	defaultOrganization: IOrganization
): Promise<OrganizationRecurringExpense[]> => {
	if (!defaultOrganization) {
		console.warn(
			'Warning: defaultOrganization not found, default organization recurring expense not be created'
		);
		return;
	}

	let mapOrganizationRecurringExpense: OrganizationRecurringExpense[] = [];
	const expenseCategories = Object.keys(
		RecurringExpenseDefaultCategoriesEnum
	);

	mapOrganizationRecurringExpense = await dataOperation(
		dataSource,
		tenant,
		mapOrganizationRecurringExpense,
		expenseCategories,
		defaultOrganization
	);
	return mapOrganizationRecurringExpense;
};

export const createRandomOrganizationRecurringExpense = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<OrganizationRecurringExpense[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, organization recurring expense not be created'
		);
		return;
	}

	let mapOrganizationRecurringExpense: OrganizationRecurringExpense[] = [];
	const expenseCategories = Object.keys(
		RecurringExpenseDefaultCategoriesEnum
	);

	for (const tenant of tenants) {
		const tenantOrganization = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrganization) {
			mapOrganizationRecurringExpense = await dataOperation(
				dataSource,
				tenant,
				mapOrganizationRecurringExpense,
				expenseCategories,
				tenantOrg
			);
		}
	}

	return mapOrganizationRecurringExpense;
};

const dataOperation = async (
	dataSource: DataSource,
	tenant: ITenant,
	mapOrganizationRecurringExpense,
	expenseCategories,
	tenantOrg: IOrganization
) => {
	for (const expenseCategory of expenseCategories) {
		const organization = new OrganizationRecurringExpense();

		const startDate = faker.date.past();
		const endDate = moment(startDate).add(1, 'months').toDate();

		organization.organization = tenantOrg;
		organization.organizationId = tenantOrg.id;
		organization.tenant = tenant;

		organization.startDay = startDate.getDate();
		organization.startMonth = startDate.getMonth() + 1;
		organization.startYear = startDate.getFullYear();
		organization.startDate = startDate;

		organization.endDay = endDate.getDate();
		organization.endMonth = endDate.getMonth();
		organization.endYear = endDate.getFullYear();
		organization.endDate = endDate;

		organization.categoryName = expenseCategory;
		organization.value = faker.number.int(9999);

		organization.currency = tenantOrg.currency || env.defaultCurrency;

		mapOrganizationRecurringExpense.push(organization);
	}
	await dataSource.manager.save(mapOrganizationRecurringExpense);
	return mapOrganizationRecurringExpense;
};
