import { Connection } from 'typeorm';
import { HelpCenterAuthor } from './help-center-author.entity';
import { HelpCenterArticle } from '../help-center-article/help-center-article.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { IEmployee } from '@gauzy/models';

export const createDefaultHelpCenterAuthor = async (
	connection: Connection,
	defaultEmployees: IEmployee[]
): Promise<HelpCenterAuthor[]> => {
	if (!defaultEmployees) {
		console.warn(
			'Warning: defaultEmployees not found, default help center author not be created'
		);
		return;
	}

	let mapEmployeeToArticles: HelpCenterAuthor[] = [];

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
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, IEmployee[]> | void
): Promise<HelpCenterAuthor[]> => {
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantEmployeeMap not found, help center author not be created'
		);
		return;
	}

	let mapEmployeeToArticles: HelpCenterAuthor[] = [];
	let employees: IEmployee[] = [];

	const allArticle = await connection.manager.find(HelpCenterArticle, {});
	for (const tenant of tenants) {
		let tenantEmployee = tenantEmployeeMap.get(tenant);
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
	data: HelpCenterAuthor[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(HelpCenterAuthor)
		.values(data)
		.execute();
};

const operateData = async (
	connection,
	mapEmployeeToArticles,
	allArticle,
	employees: IEmployee[]
) => {
	for (let i = 0; i < allArticle.length; i++) {
		const employee = faker.random.arrayElement(employees);

		const employeeMap = new HelpCenterAuthor();

		employeeMap.employeeId = employee.id;
		employeeMap.articleId = allArticle[i].id;

		mapEmployeeToArticles.push(employeeMap);
	}

	await insertRandomHelpCenterAuthor(connection, mapEmployeeToArticles);
	return mapEmployeeToArticles;
};
