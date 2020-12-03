import { Connection } from 'typeorm';
import { Report } from './report.entity';
import { ReportCategory } from './report-category.entity';
import { indexBy } from 'underscore';
import * as path from 'path';
// import { copyFileSync, mkdirSync } from 'fs';
import * as rimraf from 'rimraf';
import chalk from 'chalk';
import { environment } from '@env-api/environment';

export const createDefaultReport = async (
	connection: Connection
): Promise<Report[]> => {
	await cleanReport(connection);

	const defaultCategories: ReportCategory[] = [
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

	const reports: Report[] = [
		new Report({
			name: 'Time & Activity',
			slug: 'time-activity',
			// image: copyImage('time-activity.png'),
			category: categoryByName['Time Tracking'],
			showInMenu: true,
			iconClass: 'clock-outline',
			description:
				"See team members' time worked, activity levels, and amounts earned per project or task"
		}),
		new Report({
			name: 'Weekly',
			slug: 'weekly',
			// image: copyImage('weekly.png'),
			category: categoryByName['Time Tracking'],
			iconClass: 'calendar-outline',
			showInMenu: true,
			description:
				"See team members' time worked, activity levels, and amount earned per week"
		}),
		new Report({
			name: 'Apps & URLs',
			slug: 'apps-urls',
			// image: copyImage('apps-urls.png'),
			category: categoryByName['Time Tracking'],
			description:
				"See team members' apps used and URLs visited while working"
		}),
		new Report({
			name: 'Manual time edits',
			slug: 'manual-time-edits',
			// image: copyImage('manual-time-edits.png'),
			category: categoryByName['Time Tracking'],
			iconClass: 'browser-outline',
			description:
				"See team members' time worked, project, task, and reason for each manual time entry"
		}),
		new Report({
			name: 'Expense',
			slug: 'expense',
			// image: copyImage('expense.png'),
			category: categoryByName['Time Tracking'],
			iconClass: 'credit-card-outline',
			description:
				'See how much has been spent on expenses by member and project.'
		}),
		new Report({
			name: 'Amounts owed',
			slug: 'amounts-owed',
			// image: copyImage('amounts-owed.png'),
			category: categoryByName['Payments'],
			iconClass: 'credit-card-outline',
			description: 'See how much team members are currently owed'
		}),
		new Report({
			name: 'Payments',
			slug: 'payments',
			// image: copyImage('payments.png'),
			category: categoryByName['Payments'],
			iconClass: 'credit-card-outline',
			description:
				'See how much team members were paid over a given period'
		}),
		new Report({
			name: 'Weekly limits',
			slug: 'weekly-limits',
			// image: copyImage('weekly-limits.png'),
			category: categoryByName['Time Off'],
			description: "See team members' weekly limits usage"
		}),
		new Report({
			name: 'Daily limits',
			slug: 'daily-limits',
			// image: copyImage('daily-limits.png'),
			category: categoryByName['Time Off'],
			iconClass: 'clock-outline',
			description: "See team members' daily limits usage"
		}),
		new Report({
			name: 'Project budgets',
			slug: 'project-budgets',
			// image: copyImage('project-budgets.png'),
			category: categoryByName['Invoicing'],
			iconClass: 'credit-card-outline',
			description:
				"See how much of your projects' budgets have been spent"
		}),
		new Report({
			name: 'Client budgets',
			slug: 'client-budgets',
			// image: copyImage('client-budgets.png'),
			category: categoryByName['Invoicing'],
			iconClass: 'credit-card-outline',
			description: "See how much of your clients' budgets have been spent"
		})
	];

	return await connection.manager.save(reports);
};

async function cleanReport(connection) {
	if (environment.database.type === 'sqlite') {
		await connection.query('DELETE FROM report_category');
		await connection.query('DELETE FROM report');
	} else {
		await connection.query(
			'TRUNCATE TABLE report_category RESTART IDENTITY CASCADE'
		);
		await connection.query(
			'TRUNCATE TABLE report RESTART IDENTITY CASCADE'
		);
	}

	console.log(chalk.green(`CLEANING UP REPORT IMAGES...`));

	await new Promise((resolve, reject) => {
		const dir = path.resolve('.', ...['apps', 'api', 'public', 'reports']);

		// delete old generated report image
		rimraf(dir, () => {
			console.log(chalk.green(`CLEANED UP REPORT IMAGES`));
			resolve();
		});
	});
}

/* function copyImage(fileName: string) {
	const dir = path.resolve('.', ...[
		'apps', 
		'api', 
		'src', 
		'assets',
		'seed',
		'reports'
	]);
	const baseDir = path.resolve('.', ...[
		'apps', 
		'api', 
		'public'
	]);
	const destDir = 'reports';

	mkdirSync(path.join(baseDir, destDir), { recursive: true });

	const destFilePath = path.join(destDir, fileName);
	copyFileSync(path.join(dir, fileName), path.join(baseDir, destFilePath));

	return destFilePath;
} */
