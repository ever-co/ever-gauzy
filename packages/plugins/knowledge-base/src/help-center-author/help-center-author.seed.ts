import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { IEmployee, IHelpCenterAuthor, ITenant } from '@gauzy/contracts';
import { HelpCenterAuthor } from './help-center-author.entity';
import { HelpCenterArticle } from '../help-center-article/help-center-article.entity';

export const createDefaultHelpCenterAuthor = async (
	dataSource: DataSource,
	defaultEmployees: IEmployee[]
): Promise<IHelpCenterAuthor[]> => {
	if (!defaultEmployees) {
		console.warn(
			'Warning: defaultEmployees not found, default help center author not be created'
		);
		return;
	}

	let mapEmployeeToArticles: IHelpCenterAuthor[] = [];

	const allArticle = await dataSource.manager.find(HelpCenterArticle);

	mapEmployeeToArticles = await operateData(
		dataSource,
		mapEmployeeToArticles,
		allArticle,
		defaultEmployees
	);

	return mapEmployeeToArticles;
};

export const createRandomHelpCenterAuthor = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]> | void
): Promise<IHelpCenterAuthor[]> => {
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantEmployeeMap not found, help center author not be created'
		);
		return;
	}

	let mapEmployeeToArticles: IHelpCenterAuthor[] = [];
	const employees: IEmployee[] = [];

	const allArticle = await dataSource.manager.find(HelpCenterArticle, {});
	for (const tenant of tenants) {
		const tenantEmployee = tenantEmployeeMap.get(tenant);
		for (const tenantEmp of tenantEmployee) {
			employees.push(tenantEmp);
		}
	}

	mapEmployeeToArticles = await operateData(
		dataSource,
		mapEmployeeToArticles,
		allArticle,
		employees
	);

	return mapEmployeeToArticles;
};

const insertRandomHelpCenterAuthor = async (
	dataSource: DataSource,
	data: IHelpCenterAuthor[]
) => {
	await dataSource.manager.save(data);
};

const operateData = async (
	dataSource: DataSource,
	mapEmployeeToArticles,
	allArticle,
	employees: IEmployee[]
) => {
	for (let i = 0; i < allArticle.length; i++) {
		const employee = faker.helpers.arrayElement(employees);
		const employeeMap: IHelpCenterAuthor = new HelpCenterAuthor();

		employeeMap.employeeId = employee.id;
		employeeMap.articleId = allArticle[i].id;
		employeeMap.organizationId = employee.organizationId;
		employeeMap.tenantId = employee.tenantId;

		mapEmployeeToArticles.push(employeeMap);
	}

	await insertRandomHelpCenterAuthor(dataSource, mapEmployeeToArticles);
	return mapEmployeeToArticles;
};
