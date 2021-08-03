import { Connection } from 'typeorm';
import * as faker from 'faker';
import { IEmployee, IHelpCenterAuthor, ITenant } from '@gauzy/contracts';
import { HelpCenterAuthor } from './help-center-author.entity';
import { HelpCenterArticle } from '../help-center-article/help-center-article.entity';

export const createDefaultHelpCenterAuthor = async (
	connection: Connection,
	defaultEmployees: IEmployee[]
): Promise<IHelpCenterAuthor[]> => {
	if (!defaultEmployees) {
		console.warn(
			'Warning: defaultEmployees not found, default help center author not be created'
		);
		return;
	}

	let mapEmployeeToArticles: IHelpCenterAuthor[] = [];

	const allArticle = await connection.manager.find(HelpCenterArticle, {});

	mapEmployeeToArticles = await operateData(
		connection,
		mapEmployeeToArticles,
		allArticle,
		defaultEmployees
	);

	return mapEmployeeToArticles;
};

export const createRandomHelpCenterAuthor = async (
	connection: Connection,
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

	const allArticle = await connection.manager.find(HelpCenterArticle, {});
	for (const tenant of tenants) {
		const tenantEmployee = tenantEmployeeMap.get(tenant);
		for (const tenantEmp of tenantEmployee) {
			employees.push(tenantEmp);
		}
	}

	mapEmployeeToArticles = await operateData(
		connection,
		mapEmployeeToArticles,
		allArticle,
		employees
	);

	return mapEmployeeToArticles;
};

const insertRandomHelpCenterAuthor = async (
	connection: Connection,
	data: IHelpCenterAuthor[]
) => {
	await connection.manager.save(data);
};

const operateData = async (
	connection: Connection,
	mapEmployeeToArticles,
	allArticle,
	employees: IEmployee[]
) => {
	for (let i = 0; i < allArticle.length; i++) {
		const employee = faker.random.arrayElement(employees);
		const employeeMap: IHelpCenterAuthor = new HelpCenterAuthor();

		employeeMap.employeeId = employee.id;
		employeeMap.articleId = allArticle[i].id;
		employeeMap.organizationId = employee.organizationId;
		employeeMap.tenantId = employee.tenantId;

		mapEmployeeToArticles.push(employeeMap);
	}

	await insertRandomHelpCenterAuthor(connection, mapEmployeeToArticles);
	return mapEmployeeToArticles;
};
