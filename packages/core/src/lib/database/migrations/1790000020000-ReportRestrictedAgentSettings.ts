import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { isEEAOrUKRegion } from '@gauzy/contracts';

/**
 * Issue #9873 — report, do not change.
 *
 * Lists every organization and employee whose desktop agent settings stop the monitored worker
 * from exiting (`allowAgentAppExit = false`) or logging out (`allowLogoutFromAgentApp = false`),
 * flagging the ones that look EEA/UK, so the position can be reviewed deliberately rather than
 * flipped by a silent data migration. New restrictions are governed by the update handlers.
 *
 * Read-only and deliberately non-fatal: a report must never stop the API from booting.
 */
export class ReportRestrictedAgentSettings1790000020000 implements MigrationInterface {
	name = 'ReportRestrictedAgentSettings1790000020000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name} start running!`));

		const dbEngine = queryRunner.connection.options.type as DatabaseTypeEnum;
		const isMySQL = dbEngine === DatabaseTypeEnum.mysql;
		const q = (identifier: string) => (isMySQL ? `\`${identifier}\`` : `"${identifier}"`);
		const denied = dbEngine === DatabaseTypeEnum.postgres ? 'false' : '0';
		// A failed statement aborts a whole PostgreSQL transaction, so isolate the report in a
		// savepoint: if it fails, the migrations that run alongside it must still commit.
		const savepoint = dbEngine === DatabaseTypeEnum.postgres && queryRunner.isTransactionActive;

		try {
			if (savepoint) await queryRunner.query('SAVEPOINT agent_restriction_report');
			const organizations: Array<Record<string, any>> = await queryRunner.query(
				`SELECT o.${q('id')} AS ${q('id')}, o.${q('tenantId')} AS ${q('tenantId')}, o.${q('name')} AS ${q('name')},
					o.${q('regionCode')} AS ${q('regionCode')}, o.${q('timeZone')} AS ${q('timeZone')},
					c.${q('country')} AS ${q('country')},
					o.${q('allowAgentAppExit')} AS ${q('allowAgentAppExit')},
					o.${q('allowLogoutFromAgentApp')} AS ${q('allowLogoutFromAgentApp')}
				FROM ${q('organization')} o
				LEFT JOIN ${q('contact')} c ON c.${q('id')} = o.${q('contactId')}
				WHERE o.${q('allowAgentAppExit')} = ${denied} OR o.${q('allowLogoutFromAgentApp')} = ${denied}`
			);

			console.log(
				chalk.yellow(`[AGENT RESTRICTION REPORT] ${organizations.length} organization(s) restrict agent exit/logout`)
			);
			for (const org of organizations) {
				const eeaOrUK = isEEAOrUKRegion({
					regionCode: org.regionCode,
					timeZone: org.timeZone,
					country: org.country
				});
				console.log(
					chalk.magenta(
						` - tenant ${org.tenantId} organization ${org.id} "${org.name}": exit=${org.allowAgentAppExit} ` +
							`logout=${org.allowLogoutFromAgentApp} region=${org.regionCode || '-'} tz=${org.timeZone || '-'} ` +
							`country=${org.country || '-'} EEA/UK=${eeaOrUK ? 'YES - review' : 'no'}`
					)
				);
			}

			const employees: Array<Record<string, any>> = await queryRunner.query(
				`SELECT e.${q('id')} AS ${q('id')}, e.${q('tenantId')} AS ${q('tenantId')},
					e.${q('organizationId')} AS ${q('organizationId')},
					e.${q('allowAgentAppExit')} AS ${q('allowAgentAppExit')},
					e.${q('allowLogoutFromAgentApp')} AS ${q('allowLogoutFromAgentApp')},
					u.${q('timeZone')} AS ${q('userTimeZone')},
					ec.${q('regionCode')} AS ${q('employeeRegionCode')}, ec.${q('country')} AS ${q('employeeCountry')},
					o.${q('regionCode')} AS ${q('orgRegionCode')}, o.${q('timeZone')} AS ${q('orgTimeZone')},
					oc.${q('country')} AS ${q('orgCountry')}
				FROM ${q('employee')} e
				LEFT JOIN ${q('user')} u ON u.${q('id')} = e.${q('userId')}
				LEFT JOIN ${q('contact')} ec ON ec.${q('id')} = e.${q('contactId')}
				LEFT JOIN ${q('organization')} o ON o.${q('id')} = e.${q('organizationId')}
				LEFT JOIN ${q('contact')} oc ON oc.${q('id')} = o.${q('contactId')}
				WHERE e.${q('allowAgentAppExit')} = ${denied} OR e.${q('allowLogoutFromAgentApp')} = ${denied}`
			);

			console.log(
				chalk.yellow(`[AGENT RESTRICTION REPORT] ${employees.length} employee(s) restrict agent exit/logout`)
			);
			for (const emp of employees) {
				// Same location resolution as EmployeeUpdateHandler.
				const eeaOrUK = isEEAOrUKRegion({
					regionCode: emp.orgRegionCode || emp.employeeRegionCode,
					timeZone: emp.userTimeZone || emp.orgTimeZone,
					country: emp.employeeCountry || emp.orgCountry
				});
				console.log(
					chalk.magenta(
						` - tenant ${emp.tenantId} organization ${emp.organizationId} employee ${emp.id}: ` +
							`exit=${emp.allowAgentAppExit} logout=${emp.allowLogoutFromAgentApp} ` +
							`EEA/UK=${eeaOrUK ? 'YES - review' : 'no'}`
					)
				);
			}
			if (savepoint) await queryRunner.query('RELEASE SAVEPOINT agent_restriction_report');
		} catch (error) {
			if (savepoint) await queryRunner.query('ROLLBACK TO SAVEPOINT agent_restriction_report');
			console.log(
				chalk.red(`[AGENT RESTRICTION REPORT] could not build the report: ${(error as Error)?.message ?? error}`)
			);
		}
	}

	public async down(): Promise<void> {
		console.log(chalk.yellow(`${this.name}: report only, nothing to revert.`));
	}
}
