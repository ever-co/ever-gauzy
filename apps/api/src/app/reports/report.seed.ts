import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import { Report } from './report.entity';
import { ReportCategory } from './report-category.entity';

export const createDefaultReport = async (
	connection: Connection,
	tenant: Tenant,
	organizations: Organization[]
): Promise<Report[]> => {
	const defaultCategories: ReportCategory[] = [
		new ReportCategory({
			name: 'General'
		}),
		new ReportCategory({
			name: 'Payment'
		}),
		new ReportCategory({
			name: 'Budgets and limits'
		})
	];

	await connection.manager.save(defaultCategories);

	const reports: Report[] = [];
	for (let index = 0; index < organizations.length; index++) {
		const organization = organizations[index];
		const report = new Report({
			tenant,
			organization
		});
		reports.push(report);
	}

	return await connection.manager.save(reports);
};
