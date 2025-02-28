import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterBaseEntityAddCreatedByUserIdColumn1740744167207 implements MigrationInterface {
	name = 'AlterBaseEntityAddCreatedByUserIdColumn1740744167207';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

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
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "organization_team" DROP CONSTRAINT "FK_507bfec137b2f8bf283cb1f08d0"`);
		await queryRunner.query(`ALTER TABLE "deal" DROP CONSTRAINT "FK_4b1ff44e6bae5065429dbab554b"`);
		await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_6337f8d52d8eea1055ca8e3570b"`);
		await queryRunner.query(`ALTER TABLE "screening_task" DROP CONSTRAINT "FK_28727a84fdc4cad1cafd0701482"`);
		await queryRunner.query(`ALTER TABLE "accounting_template" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "activity_log" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "api_call_log" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "appointment_employee" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "approval_policy" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "availability_slot" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "social_account" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_criterion_rating" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_document" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_education" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_experience" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_feedback" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_interview" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_interviewer" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_personal_quality" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_skill" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_source" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_technology" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "comment" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "contact" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "country" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "currency" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "custom_smtp" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_module_employee" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "expense_category" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "user_organization" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "role" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "dashboard_widget" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "email_sent" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "email_reset" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "email_template" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_appointment" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_availability" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_award" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_level" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_phone" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_recurring_expense" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing_policy" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "equipment" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "estimate_email" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "event_type" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "expense" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "import-history" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "import-record" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "favorite" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "feature_organization" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "feature" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "goal_general_setting" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "goal_kpi_template" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "goal_kpi" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "goal_template" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "goal_time_frame" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "goal" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "image_asset" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "income" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration_entity_setting_tied" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration_entity_setting" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration_map" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration_setting" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration_tenant" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration_type" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "invite" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "invoice_estimate_history" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "invoice_item" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "invoice" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "key_result_template" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "key_result_update" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "key_result" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "language" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "mention" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "merchant" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_award" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_contact" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_department" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_document" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_employment_type" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_language" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_position" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_recurring_expense" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_sprint" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_sprint_employee" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_sprint_task" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_sprint_task_history" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_task_setting" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_team_employee" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_team_join_request" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_vendor" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "password_reset" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "pipeline_stage" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "pipeline" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_category_translation" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_category" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_option_group" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_option_group_translation" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_option_translation" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_option" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_variant_setting" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_type_translation" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_type" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_variant_price" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_variant" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_translation" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "reaction" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "report_category" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "report_organization" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "report" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "request_approval_employee" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "request_approval_team" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "request_approval" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "resource_link" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "role_permission" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "skill" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "entity_subscription" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "tag" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "tag_type" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "daily_plan" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_estimation" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "issue_type" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_linked_issues" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_priority" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_related_issue_type" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_size" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_status" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_version" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_view" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "tenant_api_key" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "tenant_setting" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "tenant" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "time_off_request" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "activity" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "screenshot" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "time_log" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "time_slot" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "timesheet" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_notification" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_notification_setting" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "user" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "warehouse_product" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "warehouse" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "changelog" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_github_repository" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_github_repository_issue" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "proposal" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_proposal_template" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "job_search_occupation" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "job_search_category" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_upwork_job_search_criterion" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "job_preset" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "job_preset_upwork_job_search_criterion" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "knowledge_base" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_author" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_review" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "video" ADD "createdByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "dashboard" DROP CONSTRAINT "FK_30613c8cd1a1df1b176dfb696ba"`);
		await queryRunner.query(`ALTER TABLE "dashboard" ALTER COLUMN "createdByUserId" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "deal" ALTER COLUMN "createdByUserId" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "payment" ALTER COLUMN "createdByUserId" DROP NOT NULL`);
		await queryRunner.query(
			`CREATE INDEX "IDX_6c31f2b8dc0eabbfae288ef948" ON "accounting_template" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_adbbea852aefe76c72fc894512" ON "activity_log" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_85fa4befda8678a5c367ebca9c" ON "api_call_log" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_b8e9f190b606d5ee710a20e2fa" ON "appointment_employee" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6c96300d656313151c7ee15962" ON "approval_policy" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_24afd2fc3370500a8da46d6bc4" ON "availability_slot" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d1f2bdaa95882411d2fc84edf0" ON "social_account" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f0adb735e7ec9a384553359cda" ON "candidate_criterion_rating" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a8a8e0569dbd89b0d8a7860704" ON "candidate_document" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_117bd40f7855b998d20638f892" ON "candidate_education" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1d5ec4350049178a7f1b1a9845" ON "candidate_experience" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bdacd0d35e50b3e7b9b392ed21" ON "candidate_feedback" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6e375eb6cd054a5ae5d10e931" ON "candidate_interview" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_29bde760d716dd8c9939a4347b" ON "candidate_interviewer" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_580faa4f0eeb000bd0428ba8b6" ON "candidate_personal_quality" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8261a7598b7dd95aafd4e302ee" ON "candidate_skill" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_aa0bbb462fb248710ffe541e16" ON "candidate_source" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_84682b709ec8185e5648cfa075" ON "candidate_technology" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_0e065bc1c8782a955c2d119029" ON "candidate" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c05bb6dfa077f32115b9d5265b" ON "comment" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_372414b5741fbca2558dd51bcc" ON "contact" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cc9a5a8eaafdafef8d0a5e6986" ON "country" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7b1616c90ee43127be7c23d6ee" ON "currency" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3f5a3c6bcfa3075e0b74cce1d0" ON "custom_smtp" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_1cfe540eb61ab18ecaf7a990b4" ON "organization_project_module_employee" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_71d0299329e15bb40da0e9c55b" ON "employee" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_20322cdd8882d4d90f2e6353a9" ON "expense_category" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e45092239d27fd82face9051c2" ON "user_organization" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_6559dd7af93b91e6e64734dbbd" ON "role" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_0fed26a1a9c0ae57e63cb999ba" ON "dashboard_widget" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_1fbd59db744b2d75f72d1740c4" ON "email_sent" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7a7f77cf8bcb04c0fff7d8dcec" ON "email_reset" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_002ebe105e95a8033b9ecd2818" ON "email_template" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_33b64f55e377e6c3deca0ab7c6" ON "employee_appointment" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d2432a113f63a381ef653c00b3" ON "employee_availability" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_65f14608c3ee5662e089a9e381" ON "employee_award" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_58f880dace5adc8d0bc1014c68" ON "employee_level" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3a7995c36ec2c642950b505c83" ON "employee_phone" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ab080828b7afec2beb2d0bd3ac" ON "employee_recurring_expense" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1a72e04cd52b24b343175493d7" ON "employee_setting" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c590c002792f5d3ac474ce926e" ON "equipment_sharing_policy" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2e2c8ba7c8f08f3dca8ff4214a" ON "equipment_sharing" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_cf7017f6c7ba42ba18ca5b064f" ON "equipment" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_6dbb9c11fd49af26f1b94a8701" ON "estimate_email" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a4dbce56eb023a9751e00361fe" ON "event_type" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f18a437c394d99c52e59db6354" ON "expense" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f238402217e5f0c405e7880588" ON "import-history" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_036a970ea565a08015c1f5945b" ON "import-record" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_3e2dd7d8e8868db14ee0ec0627" ON "favorite" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e30d59d1f3668e98aa1cd6c771" ON "feature_organization" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_1f4e0f641bfc7dc6fb8a88805a" ON "feature" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_913a06227ef8174a1f18b6fb68" ON "goal_general_setting" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2a383edd5d80fa5749d21ba587" ON "goal_kpi_template" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_3ad8c25c67b96903d6ec0c2dfe" ON "goal_kpi" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_2619e2d0d4a1685f01c720a2b6" ON "goal_template" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_744017a6861c4775ff3c9891c0" ON "goal_time_frame" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e3fa785e641991bb9e3e9a5553" ON "goal" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_973d19f095c039d799047b55b0" ON "image_asset" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_fff37149fd4ac5ed6e6bea8a20" ON "income" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_575032250f479ca096c435a2fe" ON "integration_entity_setting_tied" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a67ab869815aa2b1f464c41205" ON "integration_entity_setting" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_287014fbe563d4547dc35d3965" ON "integration_map" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fde23f67a058182ff044d15aaf" ON "integration_setting" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b30b4dc91f837d2419c55990fb" ON "integration_tenant" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c5e9048da5a56154e9bb77593a" ON "integration_type" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_00334d441014ebe0bd66ace588" ON "integration" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e9c2181253026aefd8fdf419c2" ON "invite" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b7857ca5732ca25e8c929de30" ON "invoice_estimate_history" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_75f309b2fdefc2c1f4374b6d75" ON "invoice_item" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4066edc30f31caf0488036a097" ON "invoice" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_30e9cb843b2bfb40ca7e846172" ON "key_result_template" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d2b41bb1775b62bd230459b231" ON "key_result_update" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f104dd63c1543548a67c689559" ON "key_result" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_256e57d6ee5c2fec3cfefe7bbd" ON "language" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f67fcf2e5bd2f372fc09e8babf" ON "mention" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7088de6d859564d853f222ca14" ON "merchant" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_3e6f93700a13bf5e25283ca050" ON "organization_award" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_53bb1086e10d553249483b267c" ON "organization_contact" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_107aebfb9012fa4b0dfbf8efe8" ON "organization_department" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_957bccb734db76136177dc5757" ON "organization_document" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3c32305bf5ad036779c2fbaf8e" ON "organization_employment_type" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_02706d4a9f830538445521f97e" ON "organization_language" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fc1bb945bac6efde676f1b1962" ON "organization_position" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_408532f0a32e4fef8d2684a97f" ON "organization_project" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_73e93d113f7c948ccc02a4cf17" ON "organization_project_employee" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_838801ef9f2bf6fd3c13f2bc2a" ON "organization_recurring_expense" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e23530ea000bf4f86ba6c3a2c1" ON "organization_sprint" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_98cbeba58e6957eac96dd46305" ON "organization_sprint_employee" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cc9dd6432b9d51958d9ded8d0c" ON "organization_sprint_task" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_966e9cd61eab752ffbcd3be913" ON "organization_sprint_task_history" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3e7d2ea79ab90bf9a298658feb" ON "organization_task_setting" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_470d92ce2f75abf0ef21bf10c6" ON "organization_team_employee" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2c0492979b6ac6a7cf668a75b8" ON "organization_team_join_request" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6e5f4c89cdd6517dd90d06ffac" ON "organization_vendor" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c9b171391d920c279fae8a1bf2" ON "organization" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_9d0f5b51c154e95300ea480e9c" ON "password_reset" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7971aa33e887bf9403b12a3d8c" ON "pipeline_stage" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c1ead91cbe1465fec2dd2bac92" ON "pipeline" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_cd0408cc14a6e38fab692bcd2a" ON "product_category_translation" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_268d95976c9fed57cb993dcf73" ON "product_category" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e2f01d9d3b61fc14349e01dbf1" ON "product_option_group" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4a0f8beed973e412b794cd5cb0" ON "product_option_group_translation" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f85f21357aa81e76c2bd27a400" ON "product_option_translation" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bd62ea49fa3771dca4a6f2cf56" ON "product_option" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_651ed7520280ce17de9f713659" ON "product_variant_setting" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_708af848aeecf2b99843ec4542" ON "product_type_translation" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_1d34932be4ba935408bfb6f6e0" ON "product_type" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_6bfd19cedc037cf3848ce27f51" ON "product_variant_price" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fc60009f869f76ccd8dae93cd4" ON "product_variant" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_91cfdc7f38959f4817c6372c01" ON "product" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_b43a7dc1c49031120bbd49ddcb" ON "product_translation" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f831e54ad945575c513dec516c" ON "reaction" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ca486a47d4cc60034a3e000736" ON "report_category" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f6bfc87770faea68b22dc707e0" ON "report_organization" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_67f51a7e3d1dc23416d35e18c4" ON "report" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_b9db7ba2b28ab061b1b06f8aee" ON "request_approval_employee" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_893bd441b17cb576d5b1bef0bf" ON "request_approval_team" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_95a94c342eb56b844616d6bb29" ON "request_approval" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_39572454acbe34cbe00b31b55f" ON "resource_link" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8c599f28cae7c56a379e4bc2ab" ON "role_permission" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_9b12fc4f62d6698d4a244b1399" ON "skill" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_4d44ab2374537d23199e12af3a" ON "entity_subscription" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_beb25937e143892aa1ed9b9074" ON "tag" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_454862f004b71b76ea261728e2" ON "tag_type" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_448c49007998c3402b20605245" ON "daily_plan" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e437f9c35260cc1b3cf62f1856" ON "task_estimation" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_2168e566c64144bbda008c2e2a" ON "issue_type" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_67ccd14aa974f794cbbb487920" ON "task_linked_issues" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_633fa638bd2799e16bd84a0027" ON "task_priority" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e7bb92ed1cecf32af68b64a7ea" ON "task_related_issue_type" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_561435afaf0c3ce4fb82b29d1b" ON "task_size" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ea41b7119c884bcb78902944f6" ON "task_status" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_bf036a90275ab5933d7462d31e" ON "task_version" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b4fa4106d2c1946deeb96cedf7" ON "task_view" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c22fcd623fa897e7da8a7418a" ON "tenant_api_key" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4fb3e2cc74051c62c573e3d7c7" ON "tenant_setting" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_42767c46a98febf9619e29c90c" ON "tenant" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d2a1e3252e3e4b0947757b4af3" ON "time_off_policy" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_53d606399b25e2601c43f5ac27" ON "time_off_request" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_6792bb2ff20901323af9742f44" ON "activity" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8653104849ce7a738cdde6d77f" ON "screenshot" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3f3eba95a3c7fb500ff33d2c58" ON "time_log" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d40a78a0d0a6e64e8d15f32db6" ON "time_slot" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_40e829b85b6414c85ae25f05b8" ON "time_slot_minute" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_331ee0ec4523f14d58e382804d" ON "timesheet" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_2f285063e8a703181c8b434112" ON "employee_notification" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_839092edd42db288cd3356c07d" ON "employee_notification_setting" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_ce8dcfd52a96e20ea0a8a50968" ON "user" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_75ed108d5c061677da2cfd6af3" ON "warehouse_product" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8e0914dd01679d7762bb2f7252" ON "warehouse_product_variant" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5fc461e12af1abe678ed9f6672" ON "warehouse" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_97c85aeeba993940cc26e1a08f" ON "changelog" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_b96574a62735cd2587e444c432" ON "organization_github_repository" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_57cffbbe8b00bcffd1850a1d68" ON "organization_github_repository_issue" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_4177b13c93a307d0d23d305f0e" ON "proposal" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_324fabd693ebc72ad9d87bfb6a" ON "employee_proposal_template" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d5bcacff841ec7362217d225c8" ON "job_search_occupation" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a44c5599fdb2fd51bbb10474c6" ON "job_search_category" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_43452815256c75ee08dd98cc33" ON "employee_upwork_job_search_criterion" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_fd151c80b082834ecd51cd4e0d" ON "job_preset" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c026235689297e0a9d9ebd8320" ON "job_preset_upwork_job_search_criterion" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e890a3a33801747abf348025dc" ON "knowledge_base" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b400197b7501bb75fa3a90bfce" ON "knowledge_base_article" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6fc54789b304156800b9f95a64" ON "knowledge_base_author" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_954344387e0f7bc69dca667a0a" ON "product_review" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_4251aa61a317e37fcbd204d9f5" ON "video" ("createdByUserId") `);
		await queryRunner.query(
			`ALTER TABLE "accounting_template" ADD CONSTRAINT "FK_6c31f2b8dc0eabbfae288ef9489" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "activity_log" ADD CONSTRAINT "FK_adbbea852aefe76c72fc894512c" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "api_call_log" ADD CONSTRAINT "FK_85fa4befda8678a5c367ebca9cc" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "appointment_employee" ADD CONSTRAINT "FK_b8e9f190b606d5ee710a20e2fa1" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "approval_policy" ADD CONSTRAINT "FK_6c96300d656313151c7ee15962b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "availability_slot" ADD CONSTRAINT "FK_24afd2fc3370500a8da46d6bc44" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "social_account" ADD CONSTRAINT "FK_d1f2bdaa95882411d2fc84edf0b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_criterion_rating" ADD CONSTRAINT "FK_f0adb735e7ec9a384553359cda5" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_document" ADD CONSTRAINT "FK_a8a8e0569dbd89b0d8a7860704d" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_education" ADD CONSTRAINT "FK_117bd40f7855b998d20638f892e" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_experience" ADD CONSTRAINT "FK_1d5ec4350049178a7f1b1a98455" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_feedback" ADD CONSTRAINT "FK_bdacd0d35e50b3e7b9b392ed218" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_interview" ADD CONSTRAINT "FK_d6e375eb6cd054a5ae5d10e931b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_interviewer" ADD CONSTRAINT "FK_29bde760d716dd8c9939a4347b5" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_personal_quality" ADD CONSTRAINT "FK_580faa4f0eeb000bd0428ba8b67" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_skill" ADD CONSTRAINT "FK_8261a7598b7dd95aafd4e302ee0" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_source" ADD CONSTRAINT "FK_aa0bbb462fb248710ffe541e16e" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_technology" ADD CONSTRAINT "FK_84682b709ec8185e5648cfa0755" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate" ADD CONSTRAINT "FK_0e065bc1c8782a955c2d1190299" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "comment" ADD CONSTRAINT "FK_c05bb6dfa077f32115b9d5265bb" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "contact" ADD CONSTRAINT "FK_372414b5741fbca2558dd51bcc1" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "country" ADD CONSTRAINT "FK_cc9a5a8eaafdafef8d0a5e6986b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "currency" ADD CONSTRAINT "FK_7b1616c90ee43127be7c23d6ee2" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "custom_smtp" ADD CONSTRAINT "FK_3f5a3c6bcfa3075e0b74cce1d03" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module_employee" ADD CONSTRAINT "FK_1cfe540eb61ab18ecaf7a990b4a" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee" ADD CONSTRAINT "FK_71d0299329e15bb40da0e9c55b1" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "expense_category" ADD CONSTRAINT "FK_20322cdd8882d4d90f2e6353a99" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "user_organization" ADD CONSTRAINT "FK_e45092239d27fd82face9051c2f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "role" ADD CONSTRAINT "FK_6559dd7af93b91e6e64734dbbda" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_team" ADD CONSTRAINT "FK_507bfec137b2f8bf283cb1f08d0" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "dashboard" ADD CONSTRAINT "FK_30613c8cd1a1df1b176dfb696ba" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "dashboard_widget" ADD CONSTRAINT "FK_0fed26a1a9c0ae57e63cb999bac" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "deal" ADD CONSTRAINT "FK_4b1ff44e6bae5065429dbab554b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "email_sent" ADD CONSTRAINT "FK_1fbd59db744b2d75f72d1740c4f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "email_reset" ADD CONSTRAINT "FK_7a7f77cf8bcb04c0fff7d8dcec8" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "email_template" ADD CONSTRAINT "FK_002ebe105e95a8033b9ecd2818d" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_appointment" ADD CONSTRAINT "FK_33b64f55e377e6c3deca0ab7c6f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_availability" ADD CONSTRAINT "FK_d2432a113f63a381ef653c00b3f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_award" ADD CONSTRAINT "FK_65f14608c3ee5662e089a9e3810" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_level" ADD CONSTRAINT "FK_58f880dace5adc8d0bc1014c68a" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_phone" ADD CONSTRAINT "FK_3a7995c36ec2c642950b505c835" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_recurring_expense" ADD CONSTRAINT "FK_ab080828b7afec2beb2d0bd3acc" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_setting" ADD CONSTRAINT "FK_1a72e04cd52b24b343175493d72" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "equipment_sharing_policy" ADD CONSTRAINT "FK_c590c002792f5d3ac474ce926e3" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "equipment_sharing" ADD CONSTRAINT "FK_2e2c8ba7c8f08f3dca8ff4214a6" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "equipment" ADD CONSTRAINT "FK_cf7017f6c7ba42ba18ca5b064fd" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "estimate_email" ADD CONSTRAINT "FK_6dbb9c11fd49af26f1b94a8701c" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "event_type" ADD CONSTRAINT "FK_a4dbce56eb023a9751e00361fef" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "expense" ADD CONSTRAINT "FK_f18a437c394d99c52e59db6354d" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "import-history" ADD CONSTRAINT "FK_f238402217e5f0c405e7880588c" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "import-record" ADD CONSTRAINT "FK_036a970ea565a08015c1f5945b4" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "favorite" ADD CONSTRAINT "FK_3e2dd7d8e8868db14ee0ec06276" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "feature_organization" ADD CONSTRAINT "FK_e30d59d1f3668e98aa1cd6c771c" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "feature" ADD CONSTRAINT "FK_1f4e0f641bfc7dc6fb8a88805a3" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goal_general_setting" ADD CONSTRAINT "FK_913a06227ef8174a1f18b6fb689" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goal_kpi_template" ADD CONSTRAINT "FK_2a383edd5d80fa5749d21ba587b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goal_kpi" ADD CONSTRAINT "FK_3ad8c25c67b96903d6ec0c2dfe9" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goal_template" ADD CONSTRAINT "FK_2619e2d0d4a1685f01c720a2b60" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goal_time_frame" ADD CONSTRAINT "FK_744017a6861c4775ff3c9891c02" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goal" ADD CONSTRAINT "FK_e3fa785e641991bb9e3e9a5553f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "image_asset" ADD CONSTRAINT "FK_973d19f095c039d799047b55b00" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "income" ADD CONSTRAINT "FK_fff37149fd4ac5ed6e6bea8a20d" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_entity_setting_tied" ADD CONSTRAINT "FK_575032250f479ca096c435a2fe4" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_entity_setting" ADD CONSTRAINT "FK_a67ab869815aa2b1f464c412057" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_map" ADD CONSTRAINT "FK_287014fbe563d4547dc35d39654" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_setting" ADD CONSTRAINT "FK_fde23f67a058182ff044d15aaff" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_tenant" ADD CONSTRAINT "FK_b30b4dc91f837d2419c55990fb8" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_type" ADD CONSTRAINT "FK_c5e9048da5a56154e9bb77593ae" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration" ADD CONSTRAINT "FK_00334d441014ebe0bd66ace5886" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "invite" ADD CONSTRAINT "FK_e9c2181253026aefd8fdf419c2c" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_estimate_history" ADD CONSTRAINT "FK_6b7857ca5732ca25e8c929de301" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_item" ADD CONSTRAINT "FK_75f309b2fdefc2c1f4374b6d75a" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice" ADD CONSTRAINT "FK_4066edc30f31caf0488036a0973" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "key_result_template" ADD CONSTRAINT "FK_30e9cb843b2bfb40ca7e846172b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "key_result_update" ADD CONSTRAINT "FK_d2b41bb1775b62bd230459b231d" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "key_result" ADD CONSTRAINT "FK_f104dd63c1543548a67c689559e" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "language" ADD CONSTRAINT "FK_256e57d6ee5c2fec3cfefe7bbd9" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_f67fcf2e5bd2f372fc09e8babf7" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "merchant" ADD CONSTRAINT "FK_7088de6d859564d853f222ca14f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_award" ADD CONSTRAINT "FK_3e6f93700a13bf5e25283ca050e" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_contact" ADD CONSTRAINT "FK_53bb1086e10d553249483b267cf" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_department" ADD CONSTRAINT "FK_107aebfb9012fa4b0dfbf8efe88" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_document" ADD CONSTRAINT "FK_957bccb734db76136177dc57572" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_employment_type" ADD CONSTRAINT "FK_3c32305bf5ad036779c2fbaf8e7" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_language" ADD CONSTRAINT "FK_02706d4a9f830538445521f97ee" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_position" ADD CONSTRAINT "FK_fc1bb945bac6efde676f1b19622" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project" ADD CONSTRAINT "FK_408532f0a32e4fef8d2684a97f8" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_73e93d113f7c948ccc02a4cf170" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_recurring_expense" ADD CONSTRAINT "FK_838801ef9f2bf6fd3c13f2bc2a5" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint" ADD CONSTRAINT "FK_e23530ea000bf4f86ba6c3a2c1a" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" ADD CONSTRAINT "FK_98cbeba58e6957eac96dd463057" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task" ADD CONSTRAINT "FK_cc9dd6432b9d51958d9ded8d0c7" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" ADD CONSTRAINT "FK_966e9cd61eab752ffbcd3be9130" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_task_setting" ADD CONSTRAINT "FK_3e7d2ea79ab90bf9a298658feb9" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_team_employee" ADD CONSTRAINT "FK_470d92ce2f75abf0ef21bf10c61" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_team_join_request" ADD CONSTRAINT "FK_2c0492979b6ac6a7cf668a75b84" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_vendor" ADD CONSTRAINT "FK_6e5f4c89cdd6517dd90d06ffaca" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization" ADD CONSTRAINT "FK_c9b171391d920c279fae8a1bf26" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "password_reset" ADD CONSTRAINT "FK_9d0f5b51c154e95300ea480e9cb" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payment" ADD CONSTRAINT "FK_6337f8d52d8eea1055ca8e3570b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "pipeline_stage" ADD CONSTRAINT "FK_7971aa33e887bf9403b12a3d8c4" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "pipeline" ADD CONSTRAINT "FK_c1ead91cbe1465fec2dd2bac92d" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_category_translation" ADD CONSTRAINT "FK_cd0408cc14a6e38fab692bcd2a8" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_category" ADD CONSTRAINT "FK_268d95976c9fed57cb993dcf736" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_option_group" ADD CONSTRAINT "FK_e2f01d9d3b61fc14349e01dbf17" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_option_group_translation" ADD CONSTRAINT "FK_4a0f8beed973e412b794cd5cb07" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_option_translation" ADD CONSTRAINT "FK_f85f21357aa81e76c2bd27a4002" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_option" ADD CONSTRAINT "FK_bd62ea49fa3771dca4a6f2cf56d" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_variant_setting" ADD CONSTRAINT "FK_651ed7520280ce17de9f713659a" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_type_translation" ADD CONSTRAINT "FK_708af848aeecf2b99843ec45423" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_type" ADD CONSTRAINT "FK_1d34932be4ba935408bfb6f6e04" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_variant_price" ADD CONSTRAINT "FK_6bfd19cedc037cf3848ce27f516" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_variant" ADD CONSTRAINT "FK_fc60009f869f76ccd8dae93cd48" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product" ADD CONSTRAINT "FK_91cfdc7f38959f4817c6372c019" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_translation" ADD CONSTRAINT "FK_b43a7dc1c49031120bbd49ddcbe" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "reaction" ADD CONSTRAINT "FK_f831e54ad945575c513dec516c3" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "report_category" ADD CONSTRAINT "FK_ca486a47d4cc60034a3e000736b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "report_organization" ADD CONSTRAINT "FK_f6bfc87770faea68b22dc707e01" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "report" ADD CONSTRAINT "FK_67f51a7e3d1dc23416d35e18c4f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "request_approval_employee" ADD CONSTRAINT "FK_b9db7ba2b28ab061b1b06f8aeea" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "request_approval_team" ADD CONSTRAINT "FK_893bd441b17cb576d5b1bef0bf1" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "request_approval" ADD CONSTRAINT "FK_95a94c342eb56b844616d6bb29e" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "resource_link" ADD CONSTRAINT "FK_39572454acbe34cbe00b31b55f9" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "role_permission" ADD CONSTRAINT "FK_8c599f28cae7c56a379e4bc2aba" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "skill" ADD CONSTRAINT "FK_9b12fc4f62d6698d4a244b13994" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "entity_subscription" ADD CONSTRAINT "FK_4d44ab2374537d23199e12af3a6" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tag" ADD CONSTRAINT "FK_beb25937e143892aa1ed9b90745" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tag_type" ADD CONSTRAINT "FK_454862f004b71b76ea261728e21" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "daily_plan" ADD CONSTRAINT "FK_448c49007998c3402b206052457" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_estimation" ADD CONSTRAINT "FK_e437f9c35260cc1b3cf62f18560" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "issue_type" ADD CONSTRAINT "FK_2168e566c64144bbda008c2e2a1" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_linked_issues" ADD CONSTRAINT "FK_67ccd14aa974f794cbbb487920b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_priority" ADD CONSTRAINT "FK_633fa638bd2799e16bd84a00272" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_related_issue_type" ADD CONSTRAINT "FK_e7bb92ed1cecf32af68b64a7ea2" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_size" ADD CONSTRAINT "FK_561435afaf0c3ce4fb82b29d1b1" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_status" ADD CONSTRAINT "FK_ea41b7119c884bcb78902944f62" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "screening_task" ADD CONSTRAINT "FK_28727a84fdc4cad1cafd0701482" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_version" ADD CONSTRAINT "FK_bf036a90275ab5933d7462d31e7" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_view" ADD CONSTRAINT "FK_b4fa4106d2c1946deeb96cedf79" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tenant_api_key" ADD CONSTRAINT "FK_1c22fcd623fa897e7da8a7418a4" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tenant_setting" ADD CONSTRAINT "FK_4fb3e2cc74051c62c573e3d7c73" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tenant" ADD CONSTRAINT "FK_42767c46a98febf9619e29c90c3" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_off_policy" ADD CONSTRAINT "FK_d2a1e3252e3e4b0947757b4af33" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_off_request" ADD CONSTRAINT "FK_53d606399b25e2601c43f5ac278" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "activity" ADD CONSTRAINT "FK_6792bb2ff20901323af9742f44e" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "screenshot" ADD CONSTRAINT "FK_8653104849ce7a738cdde6d77fd" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_log" ADD CONSTRAINT "FK_3f3eba95a3c7fb500ff33d2c58b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_slot" ADD CONSTRAINT "FK_d40a78a0d0a6e64e8d15f32db63" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_slot_minute" ADD CONSTRAINT "FK_40e829b85b6414c85ae25f05b8d" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet" ADD CONSTRAINT "FK_331ee0ec4523f14d58e382804d1" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification" ADD CONSTRAINT "FK_2f285063e8a703181c8b4341125" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification_setting" ADD CONSTRAINT "FK_839092edd42db288cd3356c07d7" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD CONSTRAINT "FK_ce8dcfd52a96e20ea0a8a509683" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "warehouse_product" ADD CONSTRAINT "FK_75ed108d5c061677da2cfd6af3f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "warehouse_product_variant" ADD CONSTRAINT "FK_8e0914dd01679d7762bb2f72520" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "warehouse" ADD CONSTRAINT "FK_5fc461e12af1abe678ed9f6672f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "changelog" ADD CONSTRAINT "FK_97c85aeeba993940cc26e1a08fc" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository" ADD CONSTRAINT "FK_b96574a62735cd2587e444c4322" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" ADD CONSTRAINT "FK_57cffbbe8b00bcffd1850a1d68b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "proposal" ADD CONSTRAINT "FK_4177b13c93a307d0d23d305f0e0" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_proposal_template" ADD CONSTRAINT "FK_324fabd693ebc72ad9d87bfb6a9" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "job_search_occupation" ADD CONSTRAINT "FK_d5bcacff841ec7362217d225c8c" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "job_search_category" ADD CONSTRAINT "FK_a44c5599fdb2fd51bbb10474c6b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_upwork_job_search_criterion" ADD CONSTRAINT "FK_43452815256c75ee08dd98cc33d" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "job_preset" ADD CONSTRAINT "FK_fd151c80b082834ecd51cd4e0d5" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "job_preset_upwork_job_search_criterion" ADD CONSTRAINT "FK_c026235689297e0a9d9ebd8320f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "knowledge_base" ADD CONSTRAINT "FK_e890a3a33801747abf348025dcf" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "knowledge_base_article" ADD CONSTRAINT "FK_b400197b7501bb75fa3a90bfced" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "knowledge_base_author" ADD CONSTRAINT "FK_6fc54789b304156800b9f95a647" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_review" ADD CONSTRAINT "FK_954344387e0f7bc69dca667a0af" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "video" ADD CONSTRAINT "FK_4251aa61a317e37fcbd204d9f55" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "video" DROP CONSTRAINT "FK_4251aa61a317e37fcbd204d9f55"`);
		await queryRunner.query(`ALTER TABLE "product_review" DROP CONSTRAINT "FK_954344387e0f7bc69dca667a0af"`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_author" DROP CONSTRAINT "FK_6fc54789b304156800b9f95a647"`);
		await queryRunner.query(
			`ALTER TABLE "knowledge_base_article" DROP CONSTRAINT "FK_b400197b7501bb75fa3a90bfced"`
		);
		await queryRunner.query(`ALTER TABLE "knowledge_base" DROP CONSTRAINT "FK_e890a3a33801747abf348025dcf"`);
		await queryRunner.query(
			`ALTER TABLE "job_preset_upwork_job_search_criterion" DROP CONSTRAINT "FK_c026235689297e0a9d9ebd8320f"`
		);
		await queryRunner.query(`ALTER TABLE "job_preset" DROP CONSTRAINT "FK_fd151c80b082834ecd51cd4e0d5"`);
		await queryRunner.query(
			`ALTER TABLE "employee_upwork_job_search_criterion" DROP CONSTRAINT "FK_43452815256c75ee08dd98cc33d"`
		);
		await queryRunner.query(`ALTER TABLE "job_search_category" DROP CONSTRAINT "FK_a44c5599fdb2fd51bbb10474c6b"`);
		await queryRunner.query(`ALTER TABLE "job_search_occupation" DROP CONSTRAINT "FK_d5bcacff841ec7362217d225c8c"`);
		await queryRunner.query(
			`ALTER TABLE "employee_proposal_template" DROP CONSTRAINT "FK_324fabd693ebc72ad9d87bfb6a9"`
		);
		await queryRunner.query(`ALTER TABLE "proposal" DROP CONSTRAINT "FK_4177b13c93a307d0d23d305f0e0"`);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" DROP CONSTRAINT "FK_57cffbbe8b00bcffd1850a1d68b"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository" DROP CONSTRAINT "FK_b96574a62735cd2587e444c4322"`
		);
		await queryRunner.query(`ALTER TABLE "changelog" DROP CONSTRAINT "FK_97c85aeeba993940cc26e1a08fc"`);
		await queryRunner.query(`ALTER TABLE "warehouse" DROP CONSTRAINT "FK_5fc461e12af1abe678ed9f6672f"`);
		await queryRunner.query(
			`ALTER TABLE "warehouse_product_variant" DROP CONSTRAINT "FK_8e0914dd01679d7762bb2f72520"`
		);
		await queryRunner.query(`ALTER TABLE "warehouse_product" DROP CONSTRAINT "FK_75ed108d5c061677da2cfd6af3f"`);
		await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_ce8dcfd52a96e20ea0a8a509683"`);
		await queryRunner.query(
			`ALTER TABLE "employee_notification_setting" DROP CONSTRAINT "FK_839092edd42db288cd3356c07d7"`
		);
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP CONSTRAINT "FK_2f285063e8a703181c8b4341125"`);
		await queryRunner.query(`ALTER TABLE "timesheet" DROP CONSTRAINT "FK_331ee0ec4523f14d58e382804d1"`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" DROP CONSTRAINT "FK_40e829b85b6414c85ae25f05b8d"`);
		await queryRunner.query(`ALTER TABLE "time_slot" DROP CONSTRAINT "FK_d40a78a0d0a6e64e8d15f32db63"`);
		await queryRunner.query(`ALTER TABLE "time_log" DROP CONSTRAINT "FK_3f3eba95a3c7fb500ff33d2c58b"`);
		await queryRunner.query(`ALTER TABLE "screenshot" DROP CONSTRAINT "FK_8653104849ce7a738cdde6d77fd"`);
		await queryRunner.query(`ALTER TABLE "activity" DROP CONSTRAINT "FK_6792bb2ff20901323af9742f44e"`);
		await queryRunner.query(`ALTER TABLE "time_off_request" DROP CONSTRAINT "FK_53d606399b25e2601c43f5ac278"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP CONSTRAINT "FK_d2a1e3252e3e4b0947757b4af33"`);
		await queryRunner.query(`ALTER TABLE "tenant" DROP CONSTRAINT "FK_42767c46a98febf9619e29c90c3"`);
		await queryRunner.query(`ALTER TABLE "tenant_setting" DROP CONSTRAINT "FK_4fb3e2cc74051c62c573e3d7c73"`);
		await queryRunner.query(`ALTER TABLE "tenant_api_key" DROP CONSTRAINT "FK_1c22fcd623fa897e7da8a7418a4"`);
		await queryRunner.query(`ALTER TABLE "task_view" DROP CONSTRAINT "FK_b4fa4106d2c1946deeb96cedf79"`);
		await queryRunner.query(`ALTER TABLE "task_version" DROP CONSTRAINT "FK_bf036a90275ab5933d7462d31e7"`);
		await queryRunner.query(`ALTER TABLE "screening_task" DROP CONSTRAINT "FK_28727a84fdc4cad1cafd0701482"`);
		await queryRunner.query(`ALTER TABLE "task_status" DROP CONSTRAINT "FK_ea41b7119c884bcb78902944f62"`);
		await queryRunner.query(`ALTER TABLE "task_size" DROP CONSTRAINT "FK_561435afaf0c3ce4fb82b29d1b1"`);
		await queryRunner.query(
			`ALTER TABLE "task_related_issue_type" DROP CONSTRAINT "FK_e7bb92ed1cecf32af68b64a7ea2"`
		);
		await queryRunner.query(`ALTER TABLE "task_priority" DROP CONSTRAINT "FK_633fa638bd2799e16bd84a00272"`);
		await queryRunner.query(`ALTER TABLE "task_linked_issues" DROP CONSTRAINT "FK_67ccd14aa974f794cbbb487920b"`);
		await queryRunner.query(`ALTER TABLE "issue_type" DROP CONSTRAINT "FK_2168e566c64144bbda008c2e2a1"`);
		await queryRunner.query(`ALTER TABLE "task_estimation" DROP CONSTRAINT "FK_e437f9c35260cc1b3cf62f18560"`);
		await queryRunner.query(`ALTER TABLE "daily_plan" DROP CONSTRAINT "FK_448c49007998c3402b206052457"`);
		await queryRunner.query(`ALTER TABLE "tag_type" DROP CONSTRAINT "FK_454862f004b71b76ea261728e21"`);
		await queryRunner.query(`ALTER TABLE "tag" DROP CONSTRAINT "FK_beb25937e143892aa1ed9b90745"`);
		await queryRunner.query(`ALTER TABLE "entity_subscription" DROP CONSTRAINT "FK_4d44ab2374537d23199e12af3a6"`);
		await queryRunner.query(`ALTER TABLE "skill" DROP CONSTRAINT "FK_9b12fc4f62d6698d4a244b13994"`);
		await queryRunner.query(`ALTER TABLE "role_permission" DROP CONSTRAINT "FK_8c599f28cae7c56a379e4bc2aba"`);
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_39572454acbe34cbe00b31b55f9"`);
		await queryRunner.query(`ALTER TABLE "request_approval" DROP CONSTRAINT "FK_95a94c342eb56b844616d6bb29e"`);
		await queryRunner.query(`ALTER TABLE "request_approval_team" DROP CONSTRAINT "FK_893bd441b17cb576d5b1bef0bf1"`);
		await queryRunner.query(
			`ALTER TABLE "request_approval_employee" DROP CONSTRAINT "FK_b9db7ba2b28ab061b1b06f8aeea"`
		);
		await queryRunner.query(`ALTER TABLE "report" DROP CONSTRAINT "FK_67f51a7e3d1dc23416d35e18c4f"`);
		await queryRunner.query(`ALTER TABLE "report_organization" DROP CONSTRAINT "FK_f6bfc87770faea68b22dc707e01"`);
		await queryRunner.query(`ALTER TABLE "report_category" DROP CONSTRAINT "FK_ca486a47d4cc60034a3e000736b"`);
		await queryRunner.query(`ALTER TABLE "reaction" DROP CONSTRAINT "FK_f831e54ad945575c513dec516c3"`);
		await queryRunner.query(`ALTER TABLE "product_translation" DROP CONSTRAINT "FK_b43a7dc1c49031120bbd49ddcbe"`);
		await queryRunner.query(`ALTER TABLE "product" DROP CONSTRAINT "FK_91cfdc7f38959f4817c6372c019"`);
		await queryRunner.query(`ALTER TABLE "product_variant" DROP CONSTRAINT "FK_fc60009f869f76ccd8dae93cd48"`);
		await queryRunner.query(`ALTER TABLE "product_variant_price" DROP CONSTRAINT "FK_6bfd19cedc037cf3848ce27f516"`);
		await queryRunner.query(`ALTER TABLE "product_type" DROP CONSTRAINT "FK_1d34932be4ba935408bfb6f6e04"`);
		await queryRunner.query(
			`ALTER TABLE "product_type_translation" DROP CONSTRAINT "FK_708af848aeecf2b99843ec45423"`
		);
		await queryRunner.query(
			`ALTER TABLE "product_variant_setting" DROP CONSTRAINT "FK_651ed7520280ce17de9f713659a"`
		);
		await queryRunner.query(`ALTER TABLE "product_option" DROP CONSTRAINT "FK_bd62ea49fa3771dca4a6f2cf56d"`);
		await queryRunner.query(
			`ALTER TABLE "product_option_translation" DROP CONSTRAINT "FK_f85f21357aa81e76c2bd27a4002"`
		);
		await queryRunner.query(
			`ALTER TABLE "product_option_group_translation" DROP CONSTRAINT "FK_4a0f8beed973e412b794cd5cb07"`
		);
		await queryRunner.query(`ALTER TABLE "product_option_group" DROP CONSTRAINT "FK_e2f01d9d3b61fc14349e01dbf17"`);
		await queryRunner.query(`ALTER TABLE "product_category" DROP CONSTRAINT "FK_268d95976c9fed57cb993dcf736"`);
		await queryRunner.query(
			`ALTER TABLE "product_category_translation" DROP CONSTRAINT "FK_cd0408cc14a6e38fab692bcd2a8"`
		);
		await queryRunner.query(`ALTER TABLE "pipeline" DROP CONSTRAINT "FK_c1ead91cbe1465fec2dd2bac92d"`);
		await queryRunner.query(`ALTER TABLE "pipeline_stage" DROP CONSTRAINT "FK_7971aa33e887bf9403b12a3d8c4"`);
		await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_6337f8d52d8eea1055ca8e3570b"`);
		await queryRunner.query(`ALTER TABLE "password_reset" DROP CONSTRAINT "FK_9d0f5b51c154e95300ea480e9cb"`);
		await queryRunner.query(`ALTER TABLE "organization" DROP CONSTRAINT "FK_c9b171391d920c279fae8a1bf26"`);
		await queryRunner.query(`ALTER TABLE "organization_vendor" DROP CONSTRAINT "FK_6e5f4c89cdd6517dd90d06ffaca"`);
		await queryRunner.query(
			`ALTER TABLE "organization_team_join_request" DROP CONSTRAINT "FK_2c0492979b6ac6a7cf668a75b84"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_team_employee" DROP CONSTRAINT "FK_470d92ce2f75abf0ef21bf10c61"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_task_setting" DROP CONSTRAINT "FK_3e7d2ea79ab90bf9a298658feb9"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" DROP CONSTRAINT "FK_966e9cd61eab752ffbcd3be9130"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task" DROP CONSTRAINT "FK_cc9dd6432b9d51958d9ded8d0c7"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" DROP CONSTRAINT "FK_98cbeba58e6957eac96dd463057"`
		);
		await queryRunner.query(`ALTER TABLE "organization_sprint" DROP CONSTRAINT "FK_e23530ea000bf4f86ba6c3a2c1a"`);
		await queryRunner.query(
			`ALTER TABLE "organization_recurring_expense" DROP CONSTRAINT "FK_838801ef9f2bf6fd3c13f2bc2a5"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_73e93d113f7c948ccc02a4cf170"`
		);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP CONSTRAINT "FK_408532f0a32e4fef8d2684a97f8"`);
		await queryRunner.query(`ALTER TABLE "organization_position" DROP CONSTRAINT "FK_fc1bb945bac6efde676f1b19622"`);
		await queryRunner.query(`ALTER TABLE "organization_language" DROP CONSTRAINT "FK_02706d4a9f830538445521f97ee"`);
		await queryRunner.query(
			`ALTER TABLE "organization_employment_type" DROP CONSTRAINT "FK_3c32305bf5ad036779c2fbaf8e7"`
		);
		await queryRunner.query(`ALTER TABLE "organization_document" DROP CONSTRAINT "FK_957bccb734db76136177dc57572"`);
		await queryRunner.query(
			`ALTER TABLE "organization_department" DROP CONSTRAINT "FK_107aebfb9012fa4b0dfbf8efe88"`
		);
		await queryRunner.query(`ALTER TABLE "organization_contact" DROP CONSTRAINT "FK_53bb1086e10d553249483b267cf"`);
		await queryRunner.query(`ALTER TABLE "organization_award" DROP CONSTRAINT "FK_3e6f93700a13bf5e25283ca050e"`);
		await queryRunner.query(`ALTER TABLE "merchant" DROP CONSTRAINT "FK_7088de6d859564d853f222ca14f"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_f67fcf2e5bd2f372fc09e8babf7"`);
		await queryRunner.query(`ALTER TABLE "language" DROP CONSTRAINT "FK_256e57d6ee5c2fec3cfefe7bbd9"`);
		await queryRunner.query(`ALTER TABLE "key_result" DROP CONSTRAINT "FK_f104dd63c1543548a67c689559e"`);
		await queryRunner.query(`ALTER TABLE "key_result_update" DROP CONSTRAINT "FK_d2b41bb1775b62bd230459b231d"`);
		await queryRunner.query(`ALTER TABLE "key_result_template" DROP CONSTRAINT "FK_30e9cb843b2bfb40ca7e846172b"`);
		await queryRunner.query(`ALTER TABLE "invoice" DROP CONSTRAINT "FK_4066edc30f31caf0488036a0973"`);
		await queryRunner.query(`ALTER TABLE "invoice_item" DROP CONSTRAINT "FK_75f309b2fdefc2c1f4374b6d75a"`);
		await queryRunner.query(
			`ALTER TABLE "invoice_estimate_history" DROP CONSTRAINT "FK_6b7857ca5732ca25e8c929de301"`
		);
		await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "FK_e9c2181253026aefd8fdf419c2c"`);
		await queryRunner.query(`ALTER TABLE "integration" DROP CONSTRAINT "FK_00334d441014ebe0bd66ace5886"`);
		await queryRunner.query(`ALTER TABLE "integration_type" DROP CONSTRAINT "FK_c5e9048da5a56154e9bb77593ae"`);
		await queryRunner.query(`ALTER TABLE "integration_tenant" DROP CONSTRAINT "FK_b30b4dc91f837d2419c55990fb8"`);
		await queryRunner.query(`ALTER TABLE "integration_setting" DROP CONSTRAINT "FK_fde23f67a058182ff044d15aaff"`);
		await queryRunner.query(`ALTER TABLE "integration_map" DROP CONSTRAINT "FK_287014fbe563d4547dc35d39654"`);
		await queryRunner.query(
			`ALTER TABLE "integration_entity_setting" DROP CONSTRAINT "FK_a67ab869815aa2b1f464c412057"`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_entity_setting_tied" DROP CONSTRAINT "FK_575032250f479ca096c435a2fe4"`
		);
		await queryRunner.query(`ALTER TABLE "income" DROP CONSTRAINT "FK_fff37149fd4ac5ed6e6bea8a20d"`);
		await queryRunner.query(`ALTER TABLE "image_asset" DROP CONSTRAINT "FK_973d19f095c039d799047b55b00"`);
		await queryRunner.query(`ALTER TABLE "goal" DROP CONSTRAINT "FK_e3fa785e641991bb9e3e9a5553f"`);
		await queryRunner.query(`ALTER TABLE "goal_time_frame" DROP CONSTRAINT "FK_744017a6861c4775ff3c9891c02"`);
		await queryRunner.query(`ALTER TABLE "goal_template" DROP CONSTRAINT "FK_2619e2d0d4a1685f01c720a2b60"`);
		await queryRunner.query(`ALTER TABLE "goal_kpi" DROP CONSTRAINT "FK_3ad8c25c67b96903d6ec0c2dfe9"`);
		await queryRunner.query(`ALTER TABLE "goal_kpi_template" DROP CONSTRAINT "FK_2a383edd5d80fa5749d21ba587b"`);
		await queryRunner.query(`ALTER TABLE "goal_general_setting" DROP CONSTRAINT "FK_913a06227ef8174a1f18b6fb689"`);
		await queryRunner.query(`ALTER TABLE "feature" DROP CONSTRAINT "FK_1f4e0f641bfc7dc6fb8a88805a3"`);
		await queryRunner.query(`ALTER TABLE "feature_organization" DROP CONSTRAINT "FK_e30d59d1f3668e98aa1cd6c771c"`);
		await queryRunner.query(`ALTER TABLE "favorite" DROP CONSTRAINT "FK_3e2dd7d8e8868db14ee0ec06276"`);
		await queryRunner.query(`ALTER TABLE "import-record" DROP CONSTRAINT "FK_036a970ea565a08015c1f5945b4"`);
		await queryRunner.query(`ALTER TABLE "import-history" DROP CONSTRAINT "FK_f238402217e5f0c405e7880588c"`);
		await queryRunner.query(`ALTER TABLE "expense" DROP CONSTRAINT "FK_f18a437c394d99c52e59db6354d"`);
		await queryRunner.query(`ALTER TABLE "event_type" DROP CONSTRAINT "FK_a4dbce56eb023a9751e00361fef"`);
		await queryRunner.query(`ALTER TABLE "estimate_email" DROP CONSTRAINT "FK_6dbb9c11fd49af26f1b94a8701c"`);
		await queryRunner.query(`ALTER TABLE "equipment" DROP CONSTRAINT "FK_cf7017f6c7ba42ba18ca5b064fd"`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing" DROP CONSTRAINT "FK_2e2c8ba7c8f08f3dca8ff4214a6"`);
		await queryRunner.query(
			`ALTER TABLE "equipment_sharing_policy" DROP CONSTRAINT "FK_c590c002792f5d3ac474ce926e3"`
		);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP CONSTRAINT "FK_1a72e04cd52b24b343175493d72"`);
		await queryRunner.query(
			`ALTER TABLE "employee_recurring_expense" DROP CONSTRAINT "FK_ab080828b7afec2beb2d0bd3acc"`
		);
		await queryRunner.query(`ALTER TABLE "employee_phone" DROP CONSTRAINT "FK_3a7995c36ec2c642950b505c835"`);
		await queryRunner.query(`ALTER TABLE "employee_level" DROP CONSTRAINT "FK_58f880dace5adc8d0bc1014c68a"`);
		await queryRunner.query(`ALTER TABLE "employee_award" DROP CONSTRAINT "FK_65f14608c3ee5662e089a9e3810"`);
		await queryRunner.query(`ALTER TABLE "employee_availability" DROP CONSTRAINT "FK_d2432a113f63a381ef653c00b3f"`);
		await queryRunner.query(`ALTER TABLE "employee_appointment" DROP CONSTRAINT "FK_33b64f55e377e6c3deca0ab7c6f"`);
		await queryRunner.query(`ALTER TABLE "email_template" DROP CONSTRAINT "FK_002ebe105e95a8033b9ecd2818d"`);
		await queryRunner.query(`ALTER TABLE "email_reset" DROP CONSTRAINT "FK_7a7f77cf8bcb04c0fff7d8dcec8"`);
		await queryRunner.query(`ALTER TABLE "email_sent" DROP CONSTRAINT "FK_1fbd59db744b2d75f72d1740c4f"`);
		await queryRunner.query(`ALTER TABLE "deal" DROP CONSTRAINT "FK_4b1ff44e6bae5065429dbab554b"`);
		await queryRunner.query(`ALTER TABLE "dashboard_widget" DROP CONSTRAINT "FK_0fed26a1a9c0ae57e63cb999bac"`);
		await queryRunner.query(`ALTER TABLE "dashboard" DROP CONSTRAINT "FK_30613c8cd1a1df1b176dfb696ba"`);
		await queryRunner.query(`ALTER TABLE "organization_team" DROP CONSTRAINT "FK_507bfec137b2f8bf283cb1f08d0"`);
		await queryRunner.query(`ALTER TABLE "role" DROP CONSTRAINT "FK_6559dd7af93b91e6e64734dbbda"`);
		await queryRunner.query(`ALTER TABLE "user_organization" DROP CONSTRAINT "FK_e45092239d27fd82face9051c2f"`);
		await queryRunner.query(`ALTER TABLE "expense_category" DROP CONSTRAINT "FK_20322cdd8882d4d90f2e6353a99"`);
		await queryRunner.query(`ALTER TABLE "employee" DROP CONSTRAINT "FK_71d0299329e15bb40da0e9c55b1"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module_employee" DROP CONSTRAINT "FK_1cfe540eb61ab18ecaf7a990b4a"`
		);
		await queryRunner.query(`ALTER TABLE "custom_smtp" DROP CONSTRAINT "FK_3f5a3c6bcfa3075e0b74cce1d03"`);
		await queryRunner.query(`ALTER TABLE "currency" DROP CONSTRAINT "FK_7b1616c90ee43127be7c23d6ee2"`);
		await queryRunner.query(`ALTER TABLE "country" DROP CONSTRAINT "FK_cc9a5a8eaafdafef8d0a5e6986b"`);
		await queryRunner.query(`ALTER TABLE "contact" DROP CONSTRAINT "FK_372414b5741fbca2558dd51bcc1"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_c05bb6dfa077f32115b9d5265bb"`);
		await queryRunner.query(`ALTER TABLE "candidate" DROP CONSTRAINT "FK_0e065bc1c8782a955c2d1190299"`);
		await queryRunner.query(`ALTER TABLE "candidate_technology" DROP CONSTRAINT "FK_84682b709ec8185e5648cfa0755"`);
		await queryRunner.query(`ALTER TABLE "candidate_source" DROP CONSTRAINT "FK_aa0bbb462fb248710ffe541e16e"`);
		await queryRunner.query(`ALTER TABLE "candidate_skill" DROP CONSTRAINT "FK_8261a7598b7dd95aafd4e302ee0"`);
		await queryRunner.query(
			`ALTER TABLE "candidate_personal_quality" DROP CONSTRAINT "FK_580faa4f0eeb000bd0428ba8b67"`
		);
		await queryRunner.query(`ALTER TABLE "candidate_interviewer" DROP CONSTRAINT "FK_29bde760d716dd8c9939a4347b5"`);
		await queryRunner.query(`ALTER TABLE "candidate_interview" DROP CONSTRAINT "FK_d6e375eb6cd054a5ae5d10e931b"`);
		await queryRunner.query(`ALTER TABLE "candidate_feedback" DROP CONSTRAINT "FK_bdacd0d35e50b3e7b9b392ed218"`);
		await queryRunner.query(`ALTER TABLE "candidate_experience" DROP CONSTRAINT "FK_1d5ec4350049178a7f1b1a98455"`);
		await queryRunner.query(`ALTER TABLE "candidate_education" DROP CONSTRAINT "FK_117bd40f7855b998d20638f892e"`);
		await queryRunner.query(`ALTER TABLE "candidate_document" DROP CONSTRAINT "FK_a8a8e0569dbd89b0d8a7860704d"`);
		await queryRunner.query(
			`ALTER TABLE "candidate_criterion_rating" DROP CONSTRAINT "FK_f0adb735e7ec9a384553359cda5"`
		);
		await queryRunner.query(`ALTER TABLE "social_account" DROP CONSTRAINT "FK_d1f2bdaa95882411d2fc84edf0b"`);
		await queryRunner.query(`ALTER TABLE "availability_slot" DROP CONSTRAINT "FK_24afd2fc3370500a8da46d6bc44"`);
		await queryRunner.query(`ALTER TABLE "approval_policy" DROP CONSTRAINT "FK_6c96300d656313151c7ee15962b"`);
		await queryRunner.query(`ALTER TABLE "appointment_employee" DROP CONSTRAINT "FK_b8e9f190b606d5ee710a20e2fa1"`);
		await queryRunner.query(`ALTER TABLE "api_call_log" DROP CONSTRAINT "FK_85fa4befda8678a5c367ebca9cc"`);
		await queryRunner.query(`ALTER TABLE "activity_log" DROP CONSTRAINT "FK_adbbea852aefe76c72fc894512c"`);
		await queryRunner.query(`ALTER TABLE "accounting_template" DROP CONSTRAINT "FK_6c31f2b8dc0eabbfae288ef9489"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4251aa61a317e37fcbd204d9f5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_954344387e0f7bc69dca667a0a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6fc54789b304156800b9f95a64"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b400197b7501bb75fa3a90bfce"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e890a3a33801747abf348025dc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c026235689297e0a9d9ebd8320"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fd151c80b082834ecd51cd4e0d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_43452815256c75ee08dd98cc33"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a44c5599fdb2fd51bbb10474c6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d5bcacff841ec7362217d225c8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_324fabd693ebc72ad9d87bfb6a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4177b13c93a307d0d23d305f0e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_57cffbbe8b00bcffd1850a1d68"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b96574a62735cd2587e444c432"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_97c85aeeba993940cc26e1a08f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5fc461e12af1abe678ed9f6672"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8e0914dd01679d7762bb2f7252"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_75ed108d5c061677da2cfd6af3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ce8dcfd52a96e20ea0a8a50968"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_839092edd42db288cd3356c07d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2f285063e8a703181c8b434112"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_331ee0ec4523f14d58e382804d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_40e829b85b6414c85ae25f05b8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d40a78a0d0a6e64e8d15f32db6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3f3eba95a3c7fb500ff33d2c58"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8653104849ce7a738cdde6d77f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6792bb2ff20901323af9742f44"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_53d606399b25e2601c43f5ac27"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d2a1e3252e3e4b0947757b4af3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_42767c46a98febf9619e29c90c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4fb3e2cc74051c62c573e3d7c7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1c22fcd623fa897e7da8a7418a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b4fa4106d2c1946deeb96cedf7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bf036a90275ab5933d7462d31e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ea41b7119c884bcb78902944f6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_561435afaf0c3ce4fb82b29d1b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e7bb92ed1cecf32af68b64a7ea"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_633fa638bd2799e16bd84a0027"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_67ccd14aa974f794cbbb487920"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2168e566c64144bbda008c2e2a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e437f9c35260cc1b3cf62f1856"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_448c49007998c3402b20605245"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_454862f004b71b76ea261728e2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_beb25937e143892aa1ed9b9074"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4d44ab2374537d23199e12af3a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9b12fc4f62d6698d4a244b1399"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8c599f28cae7c56a379e4bc2ab"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_39572454acbe34cbe00b31b55f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_95a94c342eb56b844616d6bb29"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_893bd441b17cb576d5b1bef0bf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b9db7ba2b28ab061b1b06f8aee"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_67f51a7e3d1dc23416d35e18c4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f6bfc87770faea68b22dc707e0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ca486a47d4cc60034a3e000736"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f831e54ad945575c513dec516c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b43a7dc1c49031120bbd49ddcb"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_91cfdc7f38959f4817c6372c01"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fc60009f869f76ccd8dae93cd4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6bfd19cedc037cf3848ce27f51"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1d34932be4ba935408bfb6f6e0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_708af848aeecf2b99843ec4542"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_651ed7520280ce17de9f713659"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bd62ea49fa3771dca4a6f2cf56"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f85f21357aa81e76c2bd27a400"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4a0f8beed973e412b794cd5cb0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e2f01d9d3b61fc14349e01dbf1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_268d95976c9fed57cb993dcf73"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cd0408cc14a6e38fab692bcd2a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c1ead91cbe1465fec2dd2bac92"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7971aa33e887bf9403b12a3d8c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9d0f5b51c154e95300ea480e9c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c9b171391d920c279fae8a1bf2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6e5f4c89cdd6517dd90d06ffac"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2c0492979b6ac6a7cf668a75b8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_470d92ce2f75abf0ef21bf10c6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3e7d2ea79ab90bf9a298658feb"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_966e9cd61eab752ffbcd3be913"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cc9dd6432b9d51958d9ded8d0c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_98cbeba58e6957eac96dd46305"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e23530ea000bf4f86ba6c3a2c1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_838801ef9f2bf6fd3c13f2bc2a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_73e93d113f7c948ccc02a4cf17"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_408532f0a32e4fef8d2684a97f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fc1bb945bac6efde676f1b1962"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_02706d4a9f830538445521f97e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3c32305bf5ad036779c2fbaf8e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_957bccb734db76136177dc5757"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_107aebfb9012fa4b0dfbf8efe8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_53bb1086e10d553249483b267c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3e6f93700a13bf5e25283ca050"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7088de6d859564d853f222ca14"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f67fcf2e5bd2f372fc09e8babf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_256e57d6ee5c2fec3cfefe7bbd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f104dd63c1543548a67c689559"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d2b41bb1775b62bd230459b231"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_30e9cb843b2bfb40ca7e846172"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4066edc30f31caf0488036a097"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_75f309b2fdefc2c1f4374b6d75"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6b7857ca5732ca25e8c929de30"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e9c2181253026aefd8fdf419c2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_00334d441014ebe0bd66ace588"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c5e9048da5a56154e9bb77593a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b30b4dc91f837d2419c55990fb"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fde23f67a058182ff044d15aaf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_287014fbe563d4547dc35d3965"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a67ab869815aa2b1f464c41205"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_575032250f479ca096c435a2fe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fff37149fd4ac5ed6e6bea8a20"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_973d19f095c039d799047b55b0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e3fa785e641991bb9e3e9a5553"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_744017a6861c4775ff3c9891c0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2619e2d0d4a1685f01c720a2b6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3ad8c25c67b96903d6ec0c2dfe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2a383edd5d80fa5749d21ba587"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_913a06227ef8174a1f18b6fb68"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1f4e0f641bfc7dc6fb8a88805a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e30d59d1f3668e98aa1cd6c771"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3e2dd7d8e8868db14ee0ec0627"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_036a970ea565a08015c1f5945b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f238402217e5f0c405e7880588"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f18a437c394d99c52e59db6354"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a4dbce56eb023a9751e00361fe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6dbb9c11fd49af26f1b94a8701"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cf7017f6c7ba42ba18ca5b064f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2e2c8ba7c8f08f3dca8ff4214a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c590c002792f5d3ac474ce926e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1a72e04cd52b24b343175493d7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ab080828b7afec2beb2d0bd3ac"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3a7995c36ec2c642950b505c83"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_58f880dace5adc8d0bc1014c68"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_65f14608c3ee5662e089a9e381"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d2432a113f63a381ef653c00b3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_33b64f55e377e6c3deca0ab7c6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_002ebe105e95a8033b9ecd2818"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7a7f77cf8bcb04c0fff7d8dcec"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1fbd59db744b2d75f72d1740c4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0fed26a1a9c0ae57e63cb999ba"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6559dd7af93b91e6e64734dbbd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e45092239d27fd82face9051c2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_20322cdd8882d4d90f2e6353a9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_71d0299329e15bb40da0e9c55b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1cfe540eb61ab18ecaf7a990b4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3f5a3c6bcfa3075e0b74cce1d0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7b1616c90ee43127be7c23d6ee"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cc9a5a8eaafdafef8d0a5e6986"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_372414b5741fbca2558dd51bcc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c05bb6dfa077f32115b9d5265b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0e065bc1c8782a955c2d119029"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_84682b709ec8185e5648cfa075"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_aa0bbb462fb248710ffe541e16"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8261a7598b7dd95aafd4e302ee"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_580faa4f0eeb000bd0428ba8b6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_29bde760d716dd8c9939a4347b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d6e375eb6cd054a5ae5d10e931"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bdacd0d35e50b3e7b9b392ed21"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1d5ec4350049178a7f1b1a9845"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_117bd40f7855b998d20638f892"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a8a8e0569dbd89b0d8a7860704"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f0adb735e7ec9a384553359cda"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d1f2bdaa95882411d2fc84edf0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_24afd2fc3370500a8da46d6bc4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6c96300d656313151c7ee15962"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b8e9f190b606d5ee710a20e2fa"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_85fa4befda8678a5c367ebca9c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_adbbea852aefe76c72fc894512"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6c31f2b8dc0eabbfae288ef948"`);
		await queryRunner.query(`ALTER TABLE "payment" ALTER COLUMN "createdByUserId" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "deal" ALTER COLUMN "createdByUserId" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "dashboard" ALTER COLUMN "createdByUserId" SET NOT NULL`);
		await queryRunner.query(
			`ALTER TABLE "dashboard" ADD CONSTRAINT "FK_30613c8cd1a1df1b176dfb696ba" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(`ALTER TABLE "video" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_review" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_author" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "knowledge_base" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "job_preset_upwork_job_search_criterion" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "job_preset" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_upwork_job_search_criterion" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "job_search_category" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "job_search_occupation" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_proposal_template" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "proposal" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_github_repository_issue" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_github_repository" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "changelog" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "warehouse" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_notification_setting" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "timesheet" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "time_slot" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "time_log" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "screenshot" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "activity" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "time_off_request" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "tenant" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "tenant_setting" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "tenant_api_key" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_view" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_version" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_status" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_size" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_related_issue_type" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_priority" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_linked_issues" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "issue_type" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_estimation" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "daily_plan" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "tag_type" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "tag" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "entity_subscription" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "role_permission" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "resource_link" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "request_approval" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "request_approval_team" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "request_approval_employee" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "report" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "report_organization" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "report_category" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "reaction" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_translation" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_variant_price" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_type" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_type_translation" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_variant_setting" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_option" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_option_translation" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_option_group_translation" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_option_group" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_category" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_category_translation" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "pipeline" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "pipeline_stage" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "password_reset" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_vendor" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_team_join_request" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_team_employee" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_task_setting" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_sprint_task_history" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_sprint_task" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_sprint_employee" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_sprint" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_recurring_expense" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_position" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_language" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_employment_type" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_document" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_department" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_contact" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_award" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "merchant" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "language" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "key_result" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "key_result_update" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "key_result_template" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "invoice_item" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "invoice_estimate_history" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "invite" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration_type" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration_tenant" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration_setting" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration_map" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration_entity_setting" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration_entity_setting_tied" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "income" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "image_asset" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "goal" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "goal_time_frame" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "goal_template" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "goal_kpi" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "goal_kpi_template" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "goal_general_setting" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "feature" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "feature_organization" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "favorite" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "import-record" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "import-history" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "expense" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "event_type" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "estimate_email" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "equipment" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing_policy" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_recurring_expense" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_phone" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_level" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_award" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_availability" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_appointment" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "email_template" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "email_reset" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "email_sent" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "dashboard_widget" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "user_organization" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "expense_category" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_module_employee" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "custom_smtp" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "currency" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "country" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "contact" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_technology" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_source" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_skill" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_personal_quality" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_interviewer" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_interview" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_feedback" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_experience" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_education" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_document" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_criterion_rating" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "social_account" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "availability_slot" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "approval_policy" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "appointment_employee" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "api_call_log" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "activity_log" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(`ALTER TABLE "accounting_template" DROP COLUMN "createdByUserId"`);
		await queryRunner.query(
			`ALTER TABLE "screening_task" ADD CONSTRAINT "FK_28727a84fdc4cad1cafd0701482" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payment" ADD CONSTRAINT "FK_6337f8d52d8eea1055ca8e3570b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "deal" ADD CONSTRAINT "FK_4b1ff44e6bae5065429dbab554b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_team" ADD CONSTRAINT "FK_507bfec137b2f8bf283cb1f08d0" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

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
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}
}
