import { ApplicationPluginConfig } from '@gauzy/common';
import { environment as env, DatabaseTypeEnum } from '@gauzy/config';
import { IReport, IReportCategory, IReportOrganization, ITenant } from '@gauzy/contracts';
import * as chalk from 'chalk';
import { copyFileSync, mkdirSync } from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import { DataSource } from 'typeorm';
import { indexBy } from 'underscore';
import { Organization } from './../core/entities/internal';
import { getDefaultOrganizations } from './../organization/organization.seed';
import { ReportCategory } from './report-category.entity';
import { ReportOrganization } from './report-organization.entity';
import { Report } from './report.entity';

export const createDefaultReport = async (
	dataSource: DataSource,
	config: Partial<ApplicationPluginConfig>,
	tenant: ITenant
): Promise<IReport[]> => {
	await cleanReport(dataSource, config);

	const defaultCategories: IReportCategory[] = [
		new ReportCategory({
			name: 'Time Tracking',
			iconClass: 'fa-clock'
		}),
		new ReportCategory({
			name: 'Payments',
			iconClass: 'fa-credit-card'
		}),
		new ReportCategory({
			name: 'Time Off',
			iconClass: 'fa-stopwatch'
		}),
		new ReportCategory({
			name: 'Invoicing',
			iconClass: 'fa-file-invoice-dollar'
		})
	];

	await dataSource.manager.save(defaultCategories);

	const categoryByName = indexBy(defaultCategories, 'name');

	const reports: IReport[] = [
		new Report({
			name: 'Time & Activity',
			slug: 'time-activity',
			image: copyImage('time-activity.png', config),
			category: categoryByName['Time Tracking'],
			showInMenu: true,
			iconClass: 'far fa-clock',
			description: "See team members' time worked, activity levels, and amounts earned per project or task"
		}),
		new Report({
			name: 'Weekly',
			slug: 'weekly',
			image: copyImage('weekly.png', config),
			category: categoryByName['Time Tracking'],
			iconClass: 'fas fa-calendar-alt',
			showInMenu: true,
			description: "See team members' time worked, activity levels, and amount earned per week"
		}),
		new Report({
			name: 'Apps & URLs',
			slug: 'apps-urls',
			image: copyImage('apps-urls.png', config),
			category: categoryByName['Time Tracking'],
			iconClass: 'far fa-window-maximize',
			description: "See team members' apps used and URLs visited while working"
		}),
		new Report({
			name: 'Manual time edits',
			slug: 'manual-time-edits',
			image: copyImage('manual-time-edits.png', config),
			category: categoryByName['Time Tracking'],
			iconClass: 'far fa-window-maximize',
			description: "See team members' time worked, project, task, and reason for each manual time entry"
		}),
		new Report({
			name: 'Expense',
			slug: 'expense',
			image: copyImage('expense.png', config),
			category: categoryByName['Time Tracking'],
			iconClass: 'far fa-credit-card',
			description: 'See how much has been spent on expenses by member and project.'
		}),
		new Report({
			name: 'Amounts owed',
			slug: 'amounts-owed',
			image: copyImage('amounts-owed.png', config),
			category: categoryByName['Payments'],
			iconClass: 'far fa-credit-card',
			description: 'See how much team members are currently owed'
		}),
		new Report({
			name: 'Payments',
			slug: 'payments',
			image: copyImage('payments.png', config),
			category: categoryByName['Payments'],
			iconClass: 'far fa-credit-card',
			description: 'See how much team members were paid over a given period'
		}),
		new Report({
			name: 'Weekly limits',
			slug: 'weekly-limits',
			image: copyImage('blank.png', config),
			category: categoryByName['Time Off'],
			iconClass: 'far fa-clock',
			description: "See team members' weekly limits usage"
		}),
		new Report({
			name: 'Daily limits',
			slug: 'daily-limits',
			image: copyImage('blank.png', config),
			category: categoryByName['Time Off'],
			iconClass: 'far fa-clock',
			description: "See team members' daily limits usage"
		}),
		new Report({
			name: 'Project budgets',
			slug: 'project-budgets',
			image: copyImage('blank.png', config),
			category: categoryByName['Invoicing'],
			iconClass: 'far fa-credit-card',
			description: "See how much of your projects' budgets have been spent"
		}),
		new Report({
			name: 'Client budgets',
			slug: 'client-budgets',
			image: copyImage('blank.png', config),
			category: categoryByName['Invoicing'],
			iconClass: 'far fa-credit-card',
			description: "See how much of your clients' budgets have been spent"
		})
	];

	await dataSource.manager.save(reports);
	await createDefaultOrganizationsReport(dataSource, reports, tenant);
	return reports;
};

async function cleanReport(dataSource: DataSource, config: Partial<ApplicationPluginConfig>) {
	const report = dataSource.getRepository(Report).metadata.tableName;
	const reportCategory = dataSource.getRepository(ReportCategory).metadata.tableName;

	const dbType = config.dbConnectionOptions.type as any;

	switch (dbType) {
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			await dataSource.query(`DELETE FROM ${reportCategory}`);
			await dataSource.query(`DELETE FROM ${report}`);
			break;
		case DatabaseTypeEnum.postgres:
			await dataSource.query(`TRUNCATE TABLE ${report}, ${reportCategory} RESTART IDENTITY CASCADE`);
			break;
		case DatabaseTypeEnum.mysql:
			// -- disable foreign_key_checks to avoid query failing when there is a foreign key in the table
			await dataSource.query('SET foreign_key_checks = 0;');
			await dataSource.query(`DELETE FROM ${reportCategory}`);
			await dataSource.query(`DELETE FROM ${report}`);
			await dataSource.query('SET foreign_key_checks = 1;');
			break;
		default:
			throw Error(`cannot clean report, report_category tables due to unsupported database type: ${dbType}`);

	}

	console.log(chalk.green(`CLEANING UP REPORT IMAGES...`));

	await new Promise((resolve, reject) => {
		const destDir = 'reports';
		const dir = env.isElectron
			? path.resolve(env.gauzyUserPath, ...['public', destDir])
			: path.join(config.assetOptions.assetPublicPath, destDir);

		// delete old generated report image
		rimraf(
			`${dir}/!(rimraf|.gitkeep)`,
			() => {
				console.log(chalk.green(`CLEANED UP REPORT IMAGES`));
				resolve(null);
			},
			() => {
				reject(null);
			}
		);
	});
}

function copyImage(fileName: string, config: Partial<ApplicationPluginConfig>) {
	try {
		const destDir = 'reports';

		const dir = env.isElectron
			? path.resolve(env.gauzySeedPath, destDir)
			: path.join(config.assetOptions.assetPath, ...['seed', destDir]) ||
			path.resolve(__dirname, '../../../', ...['apps', 'api', 'src', 'assets', 'seed', destDir]);

		const baseDir = env.isElectron
			? path.resolve(env.gauzyUserPath, ...['public'])
			: config.assetOptions.assetPublicPath || path.resolve(__dirname, '../../../', ...['apps', 'api', 'public']);

		mkdirSync(path.join(baseDir, destDir), { recursive: true });

		const destFilePath = path.join(destDir, fileName);
		copyFileSync(path.join(dir, fileName), path.join(baseDir, destFilePath));

		return destFilePath;
	} catch (err) {
		console.log(err);
	}
}

async function createDefaultOrganizationsReport(dataSource: DataSource, reports: IReport[], tenant: ITenant) {
	const organizations = await getDefaultOrganizations(dataSource, tenant);
	const reportOrganizations: IReportOrganization[] = [];
	for (const organization of organizations) {
		for (const report of reports) {
			reportOrganizations.push(
				new ReportOrganization({
					report,
					organization,
					tenant
				})
			);
		}
	}
	return await dataSource.manager.save(reportOrganizations);
}

export async function createRandomTenantOrganizationsReport(dataSource: DataSource, tenants: ITenant[]) {
	try {
		const reports = await dataSource.manager.find(Report);
		for await (const tenant of tenants) {
			const { id: tenantId } = tenant;
			const organizations = await dataSource.getRepository(Organization).find({
				where: {
					tenantId
				}
			});
			const reportOrganizations: IReportOrganization[] = [];
			for await (const organization of organizations) {
				for await (const report of reports) {
					reportOrganizations.push(
						new ReportOrganization({
							report,
							organization,
							tenant
						})
					);
				}
			}
			await dataSource.manager.save(reportOrganizations);
		}
	} catch (error) {
		console.log(chalk.red(`SEEDING Random Reports`, error));
	}
}
