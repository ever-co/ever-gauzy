import { ApplicationPluginConfig } from '@gauzy/common';
import { environment as env, DatabaseTypeEnum } from '@gauzy/config';
import { IReport, IReportCategory, IReportOrganization, ITenant } from '@gauzy/contracts';
import * as chalk from 'chalk';
import * as path from 'path';
import * as rimraf from 'rimraf';
import { DataSource } from 'typeorm';
import { Organization } from './../core/entities/internal';
import { getDefaultOrganizations } from './../organization/organization.seed';
import { ReportCategory } from './report-category.entity';
import { ReportOrganization } from './report-organization.entity';
import { Report } from './report.entity';
import { getApiPublicPath } from '../core';
import { copyAssets } from '../core/seeds/utils';

/**
 * Creates default reports and their categories for a tenant.
 *
 * This function initializes default report categories and their associated reports.
 * It cleans up existing reports and images, creates categories, and links them to
 * predefined reports, saving the entire structure in the database.
 *
 * @param {DataSource} dataSource - The database connection or ORM data source.
 * @param {Partial<ApplicationPluginConfig>} config - Configuration for handling assets.
 * @param {ITenant} tenant - The tenant for which reports are being created.
 * @returns {Promise<IReport[]>} - A promise resolving to the list of created reports.
 */
export const createDefaultReport = async (
    dataSource: DataSource,
    config: Partial<ApplicationPluginConfig>,
    tenant: ITenant
): Promise<IReport[]> => {
    // Clean up existing reports and categories
    await cleanReport(dataSource, config);

    // Define default categories
    const defaultCategories: IReportCategory[] = [
        new ReportCategory({ name: 'Time Tracking', iconClass: 'fa-clock' }),
        new ReportCategory({ name: 'Payments', iconClass: 'fa-credit-card' }),
        new ReportCategory({ name: 'Time Off', iconClass: 'fa-stopwatch' }),
        new ReportCategory({ name: 'Invoicing', iconClass: 'fa-file-invoice-dollar' }),
    ];

    // Save categories in the database
    await dataSource.manager.save(defaultCategories);

    // Map categories by name for easier assignment
    const categoryByName = Object.fromEntries(defaultCategories.map((cat) => [cat.name, cat]));

    // Define default reports
	const reports: IReport[] = [
		new Report({
			name: 'Time & Activity',
			slug: 'time-activity',
			image: copyAssets('time-activity.png', config, 'reports'),
			category: categoryByName['Time Tracking'],
			showInMenu: true,
			iconClass: 'far fa-clock',
			description: "See team members' time worked, activity levels, and amounts earned per project or task"
		}),
		new Report({
			name: 'Weekly',
			slug: 'weekly',
			image: copyAssets('weekly.png', config, 'reports'),
			category: categoryByName['Time Tracking'],
			iconClass: 'fas fa-calendar-alt',
			showInMenu: true,
			description: "See team members' time worked, activity levels, and amount earned per week"
		}),
		new Report({
			name: 'Apps & URLs',
			slug: 'apps-urls',
			image: copyAssets('apps-urls.png', config, 'reports'),
			category: categoryByName['Time Tracking'],
			iconClass: 'far fa-window-maximize',
			description: "See team members' apps used and URLs visited while working"
		}),
		new Report({
			name: 'Manual time edits',
			slug: 'manual-time-edits',
			image: copyAssets('manual-time-edits.png', config, 'reports'),
			category: categoryByName['Time Tracking'],
			iconClass: 'far fa-window-maximize',
			description: "See team members' time worked, project, task, and reason for each manual time entry"
		}),
		new Report({
			name: 'Expense',
			slug: 'expense',
			image: copyAssets('expense.png', config, 'reports'),
			category: categoryByName['Time Tracking'],
			iconClass: 'far fa-credit-card',
			description: 'See how much has been spent on expenses by member and project.'
		}),
		new Report({
			name: 'Amounts owed',
			slug: 'amounts-owed',
			image: copyAssets('amounts-owed.png', config, 'reports'),
			category: categoryByName['Payments'],
			iconClass: 'far fa-credit-card',
			description: 'See how much team members are currently owed'
		}),
		new Report({
			name: 'Payments',
			slug: 'payments',
			image: copyAssets('payments.png', config, 'reports'),
			category: categoryByName['Payments'],
			iconClass: 'far fa-credit-card',
			description: 'See how much team members were paid over a given period'
		}),
		new Report({
			name: 'Weekly limits',
			slug: 'weekly-limits',
			image: copyAssets('blank.png', config, 'reports'),
			category: categoryByName['Time Off'],
			iconClass: 'far fa-clock',
			description: "See team members' weekly limits usage"
		}),
		new Report({
			name: 'Daily limits',
			slug: 'daily-limits',
			image: copyAssets('blank.png', config, 'reports'),
			category: categoryByName['Time Off'],
			iconClass: 'far fa-clock',
			description: "See team members' daily limits usage"
		}),
		new Report({
			name: 'Project budgets',
			slug: 'project-budgets',
			image: copyAssets('blank.png', config, 'reports'),
			category: categoryByName['Invoicing'],
			iconClass: 'far fa-credit-card',
			description: "See how much of your projects' budgets have been spent"
		}),
		new Report({
			name: 'Client budgets',
			slug: 'client-budgets',
			image: copyAssets('blank.png', config, 'reports'),
			category: categoryByName['Invoicing'],
			iconClass: 'far fa-credit-card',
			description: "See how much of your clients' budgets have been spent"
		})
	];

    // Save reports in the database
    await dataSource.manager.save(reports);

    // Link reports to the tenant
    await createDefaultOrganizationsReport(dataSource, reports, tenant);

    return reports;
};


/**
 * Cleans up the `report` and `report_category` tables and deletes associated report images.
 *
 * This function performs a database cleanup for the report-related tables based on the database type
 * specified in the configuration. It also removes old report-related images from the designated directory.
 *
 * @param {DataSource} dataSource - The database connection or ORM data source.
 * @param {Partial<ApplicationPluginConfig>} config - Configuration for the application, including database options.
 * @returns {Promise<void>} - Resolves when the cleanup operation is complete.
 */
async function cleanReport(dataSource: DataSource, config: Partial<ApplicationPluginConfig>):Promise<void> {
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
		// Determine directories based on environment
		const isElectron = env.isElectron;

		// Default public directory for assets
		const publicDir = getApiPublicPath();

		// Determine the base directory for assets
		const dir = isElectron
			? path.resolve(env.gauzyUserPath, 'public/reports')
			: path.resolve(config.assetOptions?.assetPublicPath || publicDir, 'reports'); // Custom public directory path from configuration.

		console.log('Report Cleaner -> assetPublicPath: ' + dir);

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

/**
 * Creates default report-to-organization associations for a tenant.
 *
 * This function associates all default reports with all organizations belonging to a specific tenant.
 *
 * @param {DataSource} dataSource - The database connection or ORM data source.
 * @param {IReport[]} reports - The list of reports to associate with organizations.
 * @param {ITenant} tenant - The tenant for which associations are created.
 * @returns {Promise<IReportOrganization[]>} - A promise resolving to the list of saved report-to-organization associations.
 */
async function createDefaultOrganizationsReport(
    dataSource: DataSource,
    reports: IReport[],
    tenant: ITenant
): Promise<IReportOrganization[]> {
    const organizations = await getDefaultOrganizations(dataSource, tenant);
    const reportOrganizations = organizations.flatMap((organization) =>
        reports.map(
            (report) =>
                new ReportOrganization({
                    report,
                    organization,
                    tenant,
                })
        )
    );
    return await dataSource.manager.save(reportOrganizations);
}

/**
 * Creates random report-to-organization associations for multiple tenants.
 *
 * This function associates all existing reports with organizations belonging to multiple tenants.
 *
 * @param {DataSource} dataSource - The database connection or ORM data source.
 * @param {ITenant[]} tenants - A list of tenants for which associations are created.
 * @returns {Promise<void>} - Resolves when the associations are saved.
 */
export async function createRandomTenantOrganizationsReport(
    dataSource: DataSource,
    tenants: ITenant[]
): Promise<void> {
    try {
        // Fetch all existing reports
        const reports = await dataSource.manager.find(Report);

        for (const tenant of tenants) {
            const organizations = await dataSource.getRepository(Organization).find({
                where: { tenantId: tenant.id },
            });

            // Generate report-to-organization associations
            const reportOrganizations = organizations.flatMap((organization) =>
                reports.map(
                    (report) =>
                        new ReportOrganization({
                            report,
                            organization,
                            tenant,
                        })
                )
            );

            // Save the associations
            await dataSource.manager.save(reportOrganizations);
        }
    } catch (error) {
        console.log(chalk.red(`Error seeding random reports:`, error));
    }
}
