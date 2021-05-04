import { Connection } from 'typeorm';
import { Report } from './report.entity';
import { ReportCategory } from './report-category.entity';
import { indexBy } from 'underscore';
import * as path from 'path';
import { copyFileSync, mkdirSync } from 'fs';
import * as rimraf from 'rimraf';
import * as chalk from 'chalk';
import { environment as env } from '@gauzy/config';
import { IPluginConfig } from '@gauzy/common';
import { getDefaultOrganizations } from './../organization/organization.seed';
import { IReport, IReportCategory, IReportOrganization, ITenant } from '@gauzy/contracts';
import { ReportOrganization } from './report-organization.entity';

export const createDefaultReport = async (
	connection: Connection,
	config: IPluginConfig,
	tenant: ITenant
): Promise<IReport[]> => {
	await cleanReport(connection, config);

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

	await connection.manager.save(defaultCategories);

	const categoryByName = indexBy(defaultCategories, 'name');

	const reports: IReport[] = [
		new Report({
			name: 'Time & Activity',
			slug: 'time-activity',
			image: copyImage('time-activity.png', config),
			category: categoryByName['Time Tracking'],
			showInMenu: true,
			iconClass: 'clock-outline',
			description:
				"See team members' time worked, activity levels, and amounts earned per project or task"
		}),
		new Report({
			name: 'Weekly',
			slug: 'weekly',
			image: copyImage('weekly.png', config),
			category: categoryByName['Time Tracking'],
			iconClass: 'calendar-outline',
			showInMenu: true,
			description:
				"See team members' time worked, activity levels, and amount earned per week"
		}),
		new Report({
			name: 'Apps & URLs',
			slug: 'apps-urls',
			image: copyImage('apps-urls.png', config),
			category: categoryByName['Time Tracking'],
			description:
				"See team members' apps used and URLs visited while working"
		}),
		new Report({
			name: 'Manual time edits',
			slug: 'manual-time-edits',
			image: copyImage('manual-time-edits.png', config),
			category: categoryByName['Time Tracking'],
			iconClass: 'browser-outline',
			description:
				"See team members' time worked, project, task, and reason for each manual time entry"
		}),
		new Report({
			name: 'Expense',
			slug: 'expense',
			image: copyImage('expense.png', config),
			category: categoryByName['Time Tracking'],
			iconClass: 'credit-card-outline',
			description:
				'See how much has been spent on expenses by member and project.'
		}),
		new Report({
			name: 'Amounts owed',
			slug: 'amounts-owed',
			image: copyImage('amounts-owed.png', config),
			category: categoryByName['Payments'],
			iconClass: 'credit-card-outline',
			description: 'See how much team members are currently owed'
		}),
		new Report({
			name: 'Payments',
			slug: 'payments',
			image: copyImage('payments.png', config),
			category: categoryByName['Payments'],
			iconClass: 'credit-card-outline',
			description:
				'See how much team members were paid over a given period'
		}),
		new Report({
			name: 'Weekly limits',
			slug: 'weekly-limits',
			image: copyImage('blank.png', config),
			category: categoryByName['Time Off'],
			description: "See team members' weekly limits usage"
		}),
		new Report({
			name: 'Daily limits',
			slug: 'daily-limits',
			image: copyImage('blank.png', config),
			category: categoryByName['Time Off'],
			iconClass: 'clock-outline',
			description: "See team members' daily limits usage"
		}),
		new Report({
			name: 'Project budgets',
			slug: 'project-budgets',
			image: copyImage('blank.png', config),
			category: categoryByName['Invoicing'],
			iconClass: 'credit-card-outline',
			description:
				"See how much of your projects' budgets have been spent"
		}),
		new Report({
			name: 'Client budgets',
			slug: 'client-budgets',
			image: copyImage('blank.png', config),
			category: categoryByName['Invoicing'],
			iconClass: 'credit-card-outline',
			description: "See how much of your clients' budgets have been spent"
		})
	];

	await connection.manager.save(reports);
	await createDefaultOrganizationsReport(
		connection, 
		reports,
		tenant
	);
	return reports;
};

async function cleanReport(connection, config) {
	if (config.dbConnectionOptions.type === 'sqlite') {
		await connection.query('DELETE FROM report_category');
		await connection.query('DELETE FROM report');
	} else {
		await connection.query('TRUNCATE TABLE report, report_category RESTART IDENTITY CASCADE');
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

function copyImage(fileName: string, config: IPluginConfig) {
	try {
		const destDir = 'reports';

		const dir = env.isElectron
			? path.resolve(
					env.gauzyUserPath,
					...['src', 'assets', 'seed', destDir]
			  )
			: path.join(config.assetOptions.assetPath, ...['seed', destDir]) ||
			  path.resolve(
					__dirname,
					'../../../',
					...['apps', 'api', 'src', 'assets', 'seed', destDir]
			  );

		const baseDir = env.isElectron
			? path.resolve(env.gauzyUserPath, ...['public'])
			: config.assetOptions.assetPublicPath ||
			  path.resolve(
					__dirname,
					'../../../',
					...['apps', 'api', 'public']
			  );

		mkdirSync(path.join(baseDir, destDir), { recursive: true });

		const destFilePath = path.join(destDir, fileName);
		copyFileSync(
			path.join(dir, fileName),
			path.join(baseDir, destFilePath)
		);

		return destFilePath;
	} catch (err) {
		console.log(err);
	}
}

async function createDefaultOrganizationsReport(
	connection: Connection,
	reports: IReport[],
	tenant: ITenant
) {
	const organizations = await getDefaultOrganizations(
		connection,
		tenant
	);
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
	return await connection.manager.save(reportOrganizations);
}


