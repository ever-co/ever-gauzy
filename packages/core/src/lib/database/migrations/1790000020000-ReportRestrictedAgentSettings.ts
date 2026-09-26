import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { isEEAOrUKRegion } from '@gauzy/contracts';

export class ReportRestrictedAgentSettings1790000020000 implements MigrationInterface {
	name = 'ReportRestrictedAgentSettings1790000020000';

	/**
	 * Up Migration: Audit and report existing organizations and employees with restricted exit/logout settings.
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.blue(`[${this.name}] Starting audit of restricted agent settings...`));

		try {
			// Query Organizations where allowAgentAppExit is false or allowLogoutFromAgentApp is false
			const restrictedOrgs: Array<{
				id: string;
				name: string;
				regionCode?: string;
				timeZone?: string;
				allowAgentAppExit: boolean | number;
				allowLogoutFromAgentApp: boolean | number;
			}> = await queryRunner.connection
				.createQueryBuilder()
				.select([
					'organization.id AS id',
					'organization.name AS name',
					'organization.regionCode AS "regionCode"',
					'organization.timeZone AS "timeZone"',
					'organization.allowAgentAppExit AS "allowAgentAppExit"',
					'organization.allowLogoutFromAgentApp AS "allowLogoutFromAgentApp"'
				])
				.from('organization', 'organization')
				.where('organization.allowAgentAppExit = :val OR organization.allowLogoutFromAgentApp = :val', { val: false })
				.getRawMany();

			if (restrictedOrgs && restrictedOrgs.length > 0) {
				console.log(chalk.yellow(`[AUDIT REPORT] Found ${restrictedOrgs.length} Organization(s) with restricted agent settings:`));
				for (const org of restrictedOrgs) {
					const isEEAUK = isEEAOrUKRegion({ regionCode: org.regionCode, timeZone: org.timeZone });
					console.log(
						chalk.magenta(
							` - Organization ID: ${org.id}, Name: "${org.name}", Region: "${org.regionCode || 'N/A'}", ` +
							`Exit: ${org.allowAgentAppExit}, Logout: ${org.allowLogoutFromAgentApp} ` +
							`[EEA/UK Non-compliant: ${isEEAUK ? 'YES' : 'NO'}]`
						)
					);
				}
			} else {
				console.log(chalk.green(`[AUDIT REPORT] No Organizations found with restricted agent settings.`));
			}

			// Query Employees where allowAgentAppExit is false or allowLogoutFromAgentApp is false
			const restrictedEmployees: Array<{
				id: string;
				allowAgentAppExit: boolean | number;
				allowLogoutFromAgentApp: boolean | number;
			}> = await queryRunner.connection
				.createQueryBuilder()
				.select([
					'employee.id AS id',
					'employee.allowAgentAppExit AS "allowAgentAppExit"',
					'employee.allowLogoutFromAgentApp AS "allowLogoutFromAgentApp"'
				])
				.from('employee', 'employee')
				.where('employee.allowAgentAppExit = :val OR employee.allowLogoutFromAgentApp = :val', { val: false })
				.getRawMany();

			if (restrictedEmployees && restrictedEmployees.length > 0) {
				console.log(chalk.yellow(`[AUDIT REPORT] Found ${restrictedEmployees.length} Employee(s) with restricted agent settings:`));
				for (const emp of restrictedEmployees) {
					console.log(
						chalk.magenta(
							` - Employee ID: ${emp.id}, Exit: ${emp.allowAgentAppExit}, Logout: ${emp.allowLogoutFromAgentApp}`
						)
					);
				}
			} else {
				console.log(chalk.green(`[AUDIT REPORT] No Employees found with restricted agent settings.`));
			}
		} catch (error) {
			console.log(chalk.red(`[AUDIT REPORT] Error querying restricted settings during migration: ${(error as Error).message}`));
			throw error;
		}

		console.log(chalk.blue(`[${this.name}] Audit complete.`));
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`[${this.name}] Reverting report migration (no database modifications were made).`));
	}
}
