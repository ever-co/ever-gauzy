import { Connection } from 'typeorm';
import { HelpCenterAuthor } from './help-center-author.entity';
import { HelpCenterArticle } from '../help-center-article/help-center-article.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { Employee } from '@gauzy/models';
import * as _ from 'underscore';

export const createRandomHelpCenterAuthor = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, Employee[]> | void
): Promise<HelpCenterAuthor[]> => {
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantEmployeeMap not found, help center author not be created'
		);
		return;
	}

	let mapEmployeeToArticles: HelpCenterAuthor[] = [];
	let employees: Employee[] = [];

	const allArticle = await connection.manager.find(HelpCenterArticle, {});
	for (const tenant of tenants) {
		let tenantEmployee = tenantEmployeeMap.get(tenant);
		for (const tenantEmp of tenantEmployee) {
			employees.push(tenantEmp);
		}
	}

	for (let i = 0; i < allArticle.length; i++) {
		const emps = faker.random.arrayElement(employees);

		let employeeMap = new HelpCenterAuthor();

		employeeMap.employeeId = emps.id;
		employeeMap.articleId = allArticle[i].id;

		mapEmployeeToArticles.push(employeeMap);
	}
	await insertRandomHelpCenterAuthor(connection, mapEmployeeToArticles);
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
