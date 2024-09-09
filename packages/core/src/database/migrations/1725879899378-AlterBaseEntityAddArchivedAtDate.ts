import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterBaseEntityAddArchivedAtDate1725879899378 implements MigrationInterface {
	name = 'AlterBaseEntityAddArchivedAtDate1725879899378';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		switch (queryRunner.connection.options.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`accounting_template\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`appointment_employee\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`approval_policy\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`availability_slot\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`social_account\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate_criterion_rating\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate_document\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate_education\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate_experience\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate_feedback\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate_interview\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate_interviewer\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate_personal_quality\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate_skill\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate_source\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate_technology\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`candidate\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`contact\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`country\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`currency\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`custom_smtp\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`deal\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`email_sent\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`email_reset\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`email_template\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_appointment\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_award\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_level\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_phone\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_recurring_expense\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`employee\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`equipment_sharing_policy\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`equipment_sharing\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`equipment\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`estimate_email\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`event_type\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`expense_category\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`expense\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`import-history\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`import-record\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`feature_organization\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`feature\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`goal_general_setting\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`goal_kpi_template\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`goal_kpi\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`goal_template\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`goal_time_frame\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`goal\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`image_asset\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`income\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`integration_entity_setting_tied\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`integration_entity_setting\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`integration_map\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`integration_setting\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`integration_tenant\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`integration_type\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`integration\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`invite\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`invoice_estimate_history\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`invoice_item\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`invoice\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`key_result_template\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`key_result_update\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`key_result\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`language\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`merchant\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_award\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_contact\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_department\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_document\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_employment_type\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_language\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_position\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project_module\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_recurring_expense\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_sprint\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_task_setting\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_team_employee\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_team_join_request\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_team\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_vendor\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`password_reset\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`payment\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`pipeline_stage\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`pipeline\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product_category_translation\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product_category\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product_option_group\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product_option_group_translation\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product_option_translation\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product_option\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product_variant_setting\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product_type_translation\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product_type\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product_variant_price\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product_variant\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product_translation\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`report_category\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`report_organization\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`report\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`request_approval_employee\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`request_approval_team\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`request_approval\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`role_permission\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`role\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`skill\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`tag\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`daily_plan\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`task_estimation\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`issue_type\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`task\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`task\` ADD \`isDraft\` tinyint NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE \`task_linked_issues\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`task_priority\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`task_related_issue_type\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`task_size\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`task_status\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`task_status\` ADD \`isDefault\` tinyint NOT NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE \`task_version\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`tenant_setting\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`tenant\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`time_off_request\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`activity\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`screenshot\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`time_log\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`time_slot\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`time_slot_minute\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`timesheet\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`user_organization\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`user\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`warehouse_product\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`warehouse\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`changelog\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_github_repository\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository_issue\` ADD \`archivedAt\` datetime NULL`
		);
		await queryRunner.query(`ALTER TABLE \`proposal\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_proposal_template\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`job_search_occupation\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`job_search_category\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(
			`ALTER TABLE \`employee_upwork_job_search_criterion\` ADD \`archivedAt\` datetime NULL`
		);
		await queryRunner.query(`ALTER TABLE \`job_preset\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(
			`ALTER TABLE \`job_preset_upwork_job_search_criterion\` ADD \`archivedAt\` datetime NULL`
		);
		await queryRunner.query(`ALTER TABLE \`knowledge_base\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`knowledge_base_author\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`product_review\` ADD \`archivedAt\` datetime NULL`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`product_review\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`knowledge_base_author\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`knowledge_base_article\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`knowledge_base\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`job_preset_upwork_job_search_criterion\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`job_preset\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`employee_upwork_job_search_criterion\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`job_search_category\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`job_search_occupation\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`employee_proposal_template\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`proposal\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_github_repository_issue\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_github_repository\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`changelog\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`warehouse\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`warehouse_product\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`user_organization\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`timesheet\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`time_slot_minute\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`time_slot\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`time_log\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`screenshot\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`activity\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`time_off_request\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`tenant\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`tenant_setting\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`task_version\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`task_status\` DROP COLUMN \`isDefault\``);
		await queryRunner.query(`ALTER TABLE \`task_status\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`task_size\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`task_related_issue_type\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`task_priority\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`task_linked_issues\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`task\` DROP COLUMN \`isDraft\``);
		await queryRunner.query(`ALTER TABLE \`task\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`issue_type\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`task_estimation\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`daily_plan\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`tag\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`skill\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`role\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`role_permission\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`request_approval\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`request_approval_team\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`request_approval_employee\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`report\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`report_organization\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`report_category\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`product_translation\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`product\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`product_variant\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`product_variant_price\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`product_type\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`product_type_translation\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`product_variant_setting\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`product_option\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`product_option_translation\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`product_option_group_translation\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`product_option_group\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`product_category\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`product_category_translation\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`pipeline\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`pipeline_stage\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`payment\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`password_reset\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_vendor\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_team\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_team_join_request\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_team_employee\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_task_setting\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_sprint\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_recurring_expense\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_module\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_project\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_position\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_language\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_employment_type\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_document\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_department\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_contact\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_award\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`merchant\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`language\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`key_result\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`key_result_update\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`key_result_template\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`invoice\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`invoice_item\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`invoice_estimate_history\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`invite\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`integration\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`integration_type\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`integration_tenant\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`integration_setting\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`integration_map\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`integration_entity_setting\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`integration_entity_setting_tied\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`income\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`image_asset\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`goal\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`goal_time_frame\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`goal_template\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`goal_kpi\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`goal_kpi_template\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`goal_general_setting\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`feature\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`feature_organization\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`import-record\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`import-history\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`expense\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`expense_category\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`event_type\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`estimate_email\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`equipment\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`equipment_sharing\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`equipment_sharing_policy\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`employee\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`employee_recurring_expense\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`employee_phone\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`employee_level\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`employee_award\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`employee_appointment\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`email_template\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`email_reset\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`email_sent\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`deal\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`custom_smtp\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`currency\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`country\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`contact\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`candidate\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`candidate_technology\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`candidate_source\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`candidate_skill\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`candidate_personal_quality\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`candidate_interviewer\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`candidate_interview\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`candidate_feedback\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`candidate_experience\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`candidate_education\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`candidate_document\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`candidate_criterion_rating\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`social_account\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`availability_slot\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`approval_policy\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`appointment_employee\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`accounting_template\` DROP COLUMN \`archivedAt\``);
	}
}
