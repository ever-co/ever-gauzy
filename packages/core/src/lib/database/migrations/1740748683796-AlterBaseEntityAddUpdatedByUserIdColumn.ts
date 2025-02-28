import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterBaseEntityAddUpdatedByUserIdColumn1740748683796 implements MigrationInterface {
	name = 'AlterBaseEntityAddUpdatedByUserIdColumn1740748683796';

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
		await queryRunner.query(`ALTER TABLE "accounting_template" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "activity_log" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "api_call_log" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "appointment_employee" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "approval_policy" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "availability_slot" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "social_account" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_criterion_rating" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_document" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_education" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_experience" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_feedback" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_interview" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_interviewer" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_personal_quality" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_skill" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_source" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate_technology" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "candidate" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "comment" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "contact" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "country" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "currency" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "custom_smtp" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_module_employee" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "expense_category" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "user_organization" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "role" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_team" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "dashboard" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "dashboard_widget" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "deal" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "email_sent" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "email_reset" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "email_template" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_appointment" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_availability" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_award" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_level" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_phone" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_recurring_expense" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing_policy" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "equipment" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "estimate_email" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "event_type" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "expense" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "import-history" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "import-record" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "favorite" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "feature_organization" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "feature" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "goal_general_setting" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "goal_kpi_template" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "goal_kpi" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "goal_template" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "goal_time_frame" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "goal" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "image_asset" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "income" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration_entity_setting_tied" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration_entity_setting" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration_map" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration_setting" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration_tenant" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration_type" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "integration" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "invite" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "invoice_estimate_history" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "invoice_item" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "invoice" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "key_result_template" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "key_result_update" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "key_result" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "language" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "mention" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "merchant" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_award" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_contact" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_department" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_document" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_employment_type" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_language" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_position" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_module" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_recurring_expense" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_sprint" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_sprint_employee" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_sprint_task" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_sprint_task_history" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_task_setting" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_team_employee" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_team_join_request" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_vendor" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "password_reset" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "payment" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "pipeline_stage" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "pipeline" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_category_translation" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_category" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_option_group" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_option_group_translation" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_option_translation" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_option" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_variant_setting" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_type_translation" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_type" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_variant_price" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_variant" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_translation" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "reaction" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "report_category" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "report_organization" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "report" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "request_approval_employee" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "request_approval_team" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "request_approval" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "resource_link" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "role_permission" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "skill" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "entity_subscription" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "tag" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "tag_type" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "daily_plan" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_estimation" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "issue_type" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_linked_issues" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_priority" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_related_issue_type" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_size" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_status" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "screening_task" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_version" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "task_view" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "tenant_api_key" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "tenant_setting" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "tenant" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "time_off_request" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "activity" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "screenshot" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "time_log" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "time_slot" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "timesheet" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_notification" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_notification_setting" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "user" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "warehouse_product" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "warehouse" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "changelog" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_github_repository" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_github_repository_issue" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "proposal" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_proposal_template" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "job_search_occupation" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "job_search_category" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_upwork_job_search_criterion" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "job_preset" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "job_preset_upwork_job_search_criterion" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "knowledge_base" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_author" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "product_review" ADD "updatedByUserId" uuid`);
		await queryRunner.query(`ALTER TABLE "video" ADD "updatedByUserId" uuid`);
		await queryRunner.query(
			`CREATE INDEX "IDX_cef191a5d39cba98f436a3426e" ON "accounting_template" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f7ed7ad3403e192654b46744b7" ON "activity_log" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0ad05fd38874b34aa850d6aa7d" ON "api_call_log" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_04cca678432d8744940387d169" ON "appointment_employee" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a67fd3563d00880f76f00c3a2f" ON "approval_policy" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4aac964a16662fab059709e2bb" ON "availability_slot" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c00ab1a0e2c2fe377f31a3402a" ON "social_account" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b695a0ff1ab63e9284f98d842c" ON "candidate_criterion_rating" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4e61633a96e9f4b10fecc33db7" ON "candidate_document" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8c530c2dc676e52e425b66b53e" ON "candidate_education" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_789ccc968b2020ef24bcda7c9e" ON "candidate_experience" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0f0243b797e624641e53224376" ON "candidate_feedback" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_baef43f2381ec9eaaeb4bbbc83" ON "candidate_interview" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6a62665e2734dd2862bf671929" ON "candidate_interviewer" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4a66ef05e825cb5a4a509ef057" ON "candidate_personal_quality" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f4eaebf487ecf05252ec96ad2c" ON "candidate_skill" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_672fa2e19cc9fce4d2b9220086" ON "candidate_source" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5f004c022c6c17f80f2fa8d907" ON "candidate_technology" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_17a855d8deaf63978543219424" ON "candidate" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_fe1c3155e4949897eb8b1b756f" ON "comment" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_17b84c194e13003bfbd4a68912" ON "contact" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1f6217f158acf9d7d3b993590b" ON "country" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7377648bc23791951ef83b545e" ON "currency" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_976b259192623317acb4de599b" ON "custom_smtp" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_4bf84ab2b3849938c6334b7ddc" ON "organization_project_module_employee" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_ddf5990b253db3ec7b33372131" ON "employee" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_6172dc1ac8a2cf15973729ed6b" ON "expense_category" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a314c29d571530288e96975a68" ON "user_organization" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_6c088cf682d0a4bb735ccb0a31" ON "role" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e39d0402881bf9e8ac8a129fdc" ON "organization_team" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_643064af20f4f527b729779d75" ON "dashboard" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_b704dccd38e97a55cc9deac2d2" ON "dashboard_widget" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_8fa563577e08a3256f9aeee690" ON "deal" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_27586579b266385efd6fb18e3a" ON "email_sent" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9441f1450d2890cb2d23e90c01" ON "email_reset" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_7f38e534c5759d2baa11a82aa0" ON "email_template" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_299134c31638857b2d0689705a" ON "employee_appointment" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a3c8f83011c7ecdaeebcd7af7" ON "employee_availability" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9166913ec7d1e78680cd5e56b7" ON "employee_award" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bf78c02426d1eadce7e83d1824" ON "employee_level" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bd2d935878e5f2484a71a4113e" ON "employee_phone" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7881998f1f0c4f7f9c9d79c9d4" ON "employee_recurring_expense" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_846fee0cd2137ceb78dc706389" ON "employee_setting" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_33d5df882f543656ab0541b967" ON "equipment_sharing_policy" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3febe3cf1c4c2809555fe43eac" ON "equipment_sharing" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f719e1059ace526782444687c4" ON "equipment" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_795436e5d26674b5453efb1eb6" ON "estimate_email" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c901b00ed3d38800aad213bda1" ON "event_type" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_96a658f575c481d643df9958c1" ON "expense" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_1fd9a775532f8c4ab92fb72f0c" ON "import-history" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bea5edb25eb095cfdda34ba2d7" ON "import-record" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_2d50654571fd3a340cea1b9451" ON "favorite" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_a42c48c66f2869dfc147592bd7" ON "feature_organization" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c78a64011be11f508bb8709294" ON "feature" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_dcbfa613c99c3f1f43d7451628" ON "goal_general_setting" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ee45ea5731ea86d7696f939161" ON "goal_kpi_template" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b1466682a92d94f52828c455c5" ON "goal_kpi" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_a955cdbcb58f825f98920901d0" ON "goal_template" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3990c91c89a9b9f3fe87749dd6" ON "goal_time_frame" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_ead8dd87bf3c1fc2d1209e8750" ON "goal" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2dee121e5b374c1119bd3d1e1e" ON "image_asset" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_08b846d2460414b4759af81e29" ON "income" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_113a95aed26eddd1e8d40b0cdd" ON "integration_entity_setting_tied" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9e92d430204b7ff0eecc605d4d" ON "integration_entity_setting" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d253b06f6a6d0a855c287577b8" ON "integration_map" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1a60b1bc334fed4146975d845e" ON "integration_setting" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c4ff91d235c28a016ed8ab76cd" ON "integration_tenant" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9a5e5dabfb6a5cbb34ed47d1a5" ON "integration_type" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_71cbe9d1b57e634e54cd68e76a" ON "integration" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9bc9bb57684fe5963713e21c7c" ON "invite" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e7eed755eb0abffee494749340" ON "invoice_estimate_history" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_178c0bc8e33361149d4a618cca" ON "invoice_item" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b582db7d0602a1efa7d5dfa288" ON "invoice" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_512eefd7a11a4d4e68f5792765" ON "key_result_template" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fd4535b4cf367f4d9b534c1649" ON "key_result_update" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b6615253c8f84ff3c8ceeebcbe" ON "key_result" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ab2ad73ac5e4e012f6e9e4e21f" ON "language" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d467a0f5bca6530c44ec544bb8" ON "mention" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d8c4b846300725c505b363d7e3" ON "merchant" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_365dc87b5f0c60ee03b15d8557" ON "organization_award" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b5589e035e86d23ebb54ea2728" ON "organization_contact" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5b637516c71c62ebe60dac2434" ON "organization_department" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_867d292707b49ebd6c2fda0123" ON "organization_document" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0c80b521c633f26288742c068e" ON "organization_employment_type" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_89c53c0ee5dd2e4f81c63c119d" ON "organization_language" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6a2de803ef353e1bd4128d5615" ON "organization_position" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_47da91256516fc5f08685638fc" ON "organization_project" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e54a0863352454bff7b5f44014" ON "organization_project_employee" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b432fbf56ca3d370bf701c648" ON "organization_project_module" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6f63f6aed0ee00d9ada113ef59" ON "organization_recurring_expense" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b780e14e4440b83f90b2113b64" ON "organization_sprint" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9f6c5bde23442aed91b7ab15cb" ON "organization_sprint_employee" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5b93842b83905b53c2351f4f44" ON "organization_sprint_task" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8c6fb3a3f58bb321e123f38031" ON "organization_sprint_task_history" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cd4cac293f59c15f401291fd3f" ON "organization_task_setting" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9549570d7d36cdf6573a789d1e" ON "organization_team_employee" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_00501fd8af5665fa26f0f32c49" ON "organization_team_join_request" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0a59e7faf9a36b3bb49347c899" ON "organization_vendor" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_45db25594e621f1629a9fd69b9" ON "organization" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_4ef5dc6e585c4f658d8884fa82" ON "password_reset" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_8a12264602a644a5dbf88af02c" ON "payment" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_08542f025994aa9a22407c09bc" ON "pipeline_stage" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_79f791ec086b879fd7d7b0b201" ON "pipeline" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_b1c8e68b0067abbceda37b01a0" ON "product_category_translation" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_97654782fc00792c91be4e6f9e" ON "product_category" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7fab5bf2913e3588e541e8807e" ON "product_option_group" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c90d321e2429e85bb8d026acac" ON "product_option_group_translation" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7d5d930340d7d7bd8d3cba9e50" ON "product_option_translation" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4dad46f18329c23c6cea6182bd" ON "product_option" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cba4fd40413428327d9208994b" ON "product_variant_setting" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bc8384bd2b0827dc3c63eb2d4a" ON "product_type_translation" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5e105401a2b5687e6dde5ee5e8" ON "product_type" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_3e6eb519fadd77025e035cd730" ON "product_variant_price" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5ed381ac4075f551372738fb95" ON "product_variant" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_3dec567e35053c4016be0cdd51" ON "product" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f44e29486ea5cfcc274f21b096" ON "product_translation" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_d23dd04797a73993b802232dcf" ON "reaction" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_387a1e44460eeaee8213257e43" ON "report_category" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0d5f3f788befd6bd85ccc76399" ON "report_organization" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_de0e1933bf477b6d03793f8c24" ON "report" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_652566c7bfb3a6264a796bf4e0" ON "request_approval_employee" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_feef79988466a81c461b091e0c" ON "request_approval_team" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2cfc197cc78c994f77574af388" ON "request_approval" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4f6120a1ee72177cd1c20171f6" ON "resource_link" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_211933b7bf5d7dfadc3f59ead8" ON "role_permission" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a03a6b79029cfce93965d8710a" ON "skill" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c48df6f668733aba86e4fc1ee" ON "entity_subscription" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_ea1d3cd22e7295ec8565abb0f3" ON "tag" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_abbfb2e8570aa596de3ec34fbc" ON "tag_type" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_73dccc6583e06b46e4ea165765" ON "daily_plan" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_87d1283c8acceb61f224d6f524" ON "task_estimation" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b0b6fd6c28c53dc79291862d71" ON "issue_type" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d03277be13515e98c386d432bc" ON "task" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_3c7e566cd87dc3ed06afb3a4cd" ON "task_linked_issues" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_88f7144b59d9068645c963bb7f" ON "task_priority" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_845bbcb29db985e512a3580971" ON "task_related_issue_type" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_ae9f30be60b2a37fbd6f644945" ON "task_size" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1be690427688d4ad5393c5fb25" ON "task_status" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d825a14a0a052dc2aa462ec556" ON "screening_task" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_1893260d31d65376dc81581125" ON "task_version" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8908342a94b3c246b3721f1ed9" ON "task_view" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_3109be70c53bb955dfd81f4bcf" ON "tenant_api_key" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c6a178bebfadc031aed89c3c48" ON "tenant_setting" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_9e6580ac3a746927e959988176" ON "tenant" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6195ede8e752a3b5196b14c2d" ON "time_off_policy" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7b99c26d1cf3418c1c5c56ce7c" ON "time_off_request" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a0e09af2ccba1e9a41b05e177b" ON "activity" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9fc0c7f0224ca55e33c0030581" ON "screenshot" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4b3d54bc990cb48a2eccac9a28" ON "time_log" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_596e0e849822aa09ec0d4a1052" ON "time_slot" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_7b8440953eeff74641d33cc293" ON "time_slot_minute" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_efb2f5b73f2cd229d9f504800e" ON "timesheet" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c8eeb269adb12f405d340eb7de" ON "employee_notification" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8c18ac3008773c2f4c7221ac4f" ON "employee_notification_setting" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f9c50080ce4ebec4adfc88e59b" ON "user" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_713e473a0d6cdff1ddd5a72f94" ON "warehouse_product" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_dcebf5d5ca74f856848bf0b98e" ON "warehouse_product_variant" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_d4ca9b0bb898d2fcbf2119b7d1" ON "warehouse" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d3581ca2376e233c4a13370308" ON "changelog" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e07283577a97aec8ab464294e6" ON "organization_github_repository" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_379156a73559f00aef19004e79" ON "organization_github_repository_issue" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_6253b81523c6b60f86ef46502b" ON "proposal" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_b4c739f40184262b276c07fb80" ON "employee_proposal_template" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e73efaf3344565bf6d1a78f6ac" ON "job_search_occupation" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0cdc2fecd8e73bc2ff847bc829" ON "job_search_category" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d76576758fff558b566f2d1b14" ON "employee_upwork_job_search_criterion" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_6a753c247307a9e770864ce34e" ON "job_preset" ("updatedByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_212e610ebfca3c1a55c60105a1" ON "job_preset_upwork_job_search_criterion" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f4d647f99da579f4343925c53c" ON "knowledge_base" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2de1afe05be78b65ea1d39bdec" ON "knowledge_base_article" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b5a0a0fb39fafe6eb7d21451bf" ON "knowledge_base_author" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a13b7839be9f72585c0a9e0833" ON "product_review" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c99fe6b6f9549a9f03c7ed5594" ON "video" ("updatedByUserId") `);
		await queryRunner.query(
			`ALTER TABLE "accounting_template" ADD CONSTRAINT "FK_cef191a5d39cba98f436a3426e2" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "activity_log" ADD CONSTRAINT "FK_f7ed7ad3403e192654b46744b7d" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "api_call_log" ADD CONSTRAINT "FK_0ad05fd38874b34aa850d6aa7d0" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "appointment_employee" ADD CONSTRAINT "FK_04cca678432d8744940387d169f" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "approval_policy" ADD CONSTRAINT "FK_a67fd3563d00880f76f00c3a2fc" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "availability_slot" ADD CONSTRAINT "FK_4aac964a16662fab059709e2bb9" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "social_account" ADD CONSTRAINT "FK_c00ab1a0e2c2fe377f31a3402a3" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_criterion_rating" ADD CONSTRAINT "FK_b695a0ff1ab63e9284f98d842cb" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_document" ADD CONSTRAINT "FK_4e61633a96e9f4b10fecc33db7e" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_education" ADD CONSTRAINT "FK_8c530c2dc676e52e425b66b53ef" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_experience" ADD CONSTRAINT "FK_789ccc968b2020ef24bcda7c9e5" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_feedback" ADD CONSTRAINT "FK_0f0243b797e624641e53224376a" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_interview" ADD CONSTRAINT "FK_baef43f2381ec9eaaeb4bbbc833" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_interviewer" ADD CONSTRAINT "FK_6a62665e2734dd2862bf6719291" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_personal_quality" ADD CONSTRAINT "FK_4a66ef05e825cb5a4a509ef057d" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_skill" ADD CONSTRAINT "FK_f4eaebf487ecf05252ec96ad2c5" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_source" ADD CONSTRAINT "FK_672fa2e19cc9fce4d2b9220086c" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate_technology" ADD CONSTRAINT "FK_5f004c022c6c17f80f2fa8d9079" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "candidate" ADD CONSTRAINT "FK_17a855d8deaf639785432194248" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "comment" ADD CONSTRAINT "FK_fe1c3155e4949897eb8b1b756fb" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "contact" ADD CONSTRAINT "FK_17b84c194e13003bfbd4a689120" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "country" ADD CONSTRAINT "FK_1f6217f158acf9d7d3b993590b9" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "currency" ADD CONSTRAINT "FK_7377648bc23791951ef83b545ee" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "custom_smtp" ADD CONSTRAINT "FK_976b259192623317acb4de599b1" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module_employee" ADD CONSTRAINT "FK_4bf84ab2b3849938c6334b7ddc3" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee" ADD CONSTRAINT "FK_ddf5990b253db3ec7b333721312" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "expense_category" ADD CONSTRAINT "FK_6172dc1ac8a2cf15973729ed6bd" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "user_organization" ADD CONSTRAINT "FK_a314c29d571530288e96975a685" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "role" ADD CONSTRAINT "FK_6c088cf682d0a4bb735ccb0a311" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_team" ADD CONSTRAINT "FK_e39d0402881bf9e8ac8a129fdc5" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "dashboard" ADD CONSTRAINT "FK_643064af20f4f527b729779d753" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "dashboard_widget" ADD CONSTRAINT "FK_b704dccd38e97a55cc9deac2d28" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "deal" ADD CONSTRAINT "FK_8fa563577e08a3256f9aeee690c" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "email_sent" ADD CONSTRAINT "FK_27586579b266385efd6fb18e3ae" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "email_reset" ADD CONSTRAINT "FK_9441f1450d2890cb2d23e90c011" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "email_template" ADD CONSTRAINT "FK_7f38e534c5759d2baa11a82aa03" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_appointment" ADD CONSTRAINT "FK_299134c31638857b2d0689705ae" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_availability" ADD CONSTRAINT "FK_8a3c8f83011c7ecdaeebcd7af72" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_award" ADD CONSTRAINT "FK_9166913ec7d1e78680cd5e56b79" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_level" ADD CONSTRAINT "FK_bf78c02426d1eadce7e83d18245" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_phone" ADD CONSTRAINT "FK_bd2d935878e5f2484a71a4113e2" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_recurring_expense" ADD CONSTRAINT "FK_7881998f1f0c4f7f9c9d79c9d44" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_setting" ADD CONSTRAINT "FK_846fee0cd2137ceb78dc706389a" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "equipment_sharing_policy" ADD CONSTRAINT "FK_33d5df882f543656ab0541b967b" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "equipment_sharing" ADD CONSTRAINT "FK_3febe3cf1c4c2809555fe43eac2" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "equipment" ADD CONSTRAINT "FK_f719e1059ace526782444687c48" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "estimate_email" ADD CONSTRAINT "FK_795436e5d26674b5453efb1eb64" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "event_type" ADD CONSTRAINT "FK_c901b00ed3d38800aad213bda19" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "expense" ADD CONSTRAINT "FK_96a658f575c481d643df9958c1c" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "import-history" ADD CONSTRAINT "FK_1fd9a775532f8c4ab92fb72f0cd" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "import-record" ADD CONSTRAINT "FK_bea5edb25eb095cfdda34ba2d7b" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "favorite" ADD CONSTRAINT "FK_2d50654571fd3a340cea1b94510" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "feature_organization" ADD CONSTRAINT "FK_a42c48c66f2869dfc147592bd7c" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "feature" ADD CONSTRAINT "FK_c78a64011be11f508bb87092949" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goal_general_setting" ADD CONSTRAINT "FK_dcbfa613c99c3f1f43d74516286" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goal_kpi_template" ADD CONSTRAINT "FK_ee45ea5731ea86d7696f939161a" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goal_kpi" ADD CONSTRAINT "FK_b1466682a92d94f52828c455c54" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goal_template" ADD CONSTRAINT "FK_a955cdbcb58f825f98920901d08" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goal_time_frame" ADD CONSTRAINT "FK_3990c91c89a9b9f3fe87749dd60" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "goal" ADD CONSTRAINT "FK_ead8dd87bf3c1fc2d1209e87509" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "image_asset" ADD CONSTRAINT "FK_2dee121e5b374c1119bd3d1e1e6" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "income" ADD CONSTRAINT "FK_08b846d2460414b4759af81e29b" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_entity_setting_tied" ADD CONSTRAINT "FK_113a95aed26eddd1e8d40b0cddb" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_entity_setting" ADD CONSTRAINT "FK_9e92d430204b7ff0eecc605d4d0" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_map" ADD CONSTRAINT "FK_d253b06f6a6d0a855c287577b84" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_setting" ADD CONSTRAINT "FK_1a60b1bc334fed4146975d845ed" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_tenant" ADD CONSTRAINT "FK_c4ff91d235c28a016ed8ab76cd3" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_type" ADD CONSTRAINT "FK_9a5e5dabfb6a5cbb34ed47d1a59" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "integration" ADD CONSTRAINT "FK_71cbe9d1b57e634e54cd68e76af" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "invite" ADD CONSTRAINT "FK_9bc9bb57684fe5963713e21c7c8" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_estimate_history" ADD CONSTRAINT "FK_e7eed755eb0abffee4947493406" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice_item" ADD CONSTRAINT "FK_178c0bc8e33361149d4a618cca7" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "invoice" ADD CONSTRAINT "FK_b582db7d0602a1efa7d5dfa288e" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "key_result_template" ADD CONSTRAINT "FK_512eefd7a11a4d4e68f57927650" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "key_result_update" ADD CONSTRAINT "FK_fd4535b4cf367f4d9b534c16496" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "key_result" ADD CONSTRAINT "FK_b6615253c8f84ff3c8ceeebcbe0" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "language" ADD CONSTRAINT "FK_ab2ad73ac5e4e012f6e9e4e21f9" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_d467a0f5bca6530c44ec544bb84" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "merchant" ADD CONSTRAINT "FK_d8c4b846300725c505b363d7e34" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_award" ADD CONSTRAINT "FK_365dc87b5f0c60ee03b15d85576" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_contact" ADD CONSTRAINT "FK_b5589e035e86d23ebb54ea2728c" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_department" ADD CONSTRAINT "FK_5b637516c71c62ebe60dac24346" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_document" ADD CONSTRAINT "FK_867d292707b49ebd6c2fda01230" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_employment_type" ADD CONSTRAINT "FK_0c80b521c633f26288742c068e7" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_language" ADD CONSTRAINT "FK_89c53c0ee5dd2e4f81c63c119d4" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_position" ADD CONSTRAINT "FK_6a2de803ef353e1bd4128d5615f" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project" ADD CONSTRAINT "FK_47da91256516fc5f08685638fca" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_e54a0863352454bff7b5f440145" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" ADD CONSTRAINT "FK_6b432fbf56ca3d370bf701c6486" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_recurring_expense" ADD CONSTRAINT "FK_6f63f6aed0ee00d9ada113ef597" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint" ADD CONSTRAINT "FK_b780e14e4440b83f90b2113b646" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" ADD CONSTRAINT "FK_9f6c5bde23442aed91b7ab15cbb" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task" ADD CONSTRAINT "FK_5b93842b83905b53c2351f4f44b" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" ADD CONSTRAINT "FK_8c6fb3a3f58bb321e123f380312" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_task_setting" ADD CONSTRAINT "FK_cd4cac293f59c15f401291fd3f9" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_team_employee" ADD CONSTRAINT "FK_9549570d7d36cdf6573a789d1ec" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_team_join_request" ADD CONSTRAINT "FK_00501fd8af5665fa26f0f32c496" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_vendor" ADD CONSTRAINT "FK_0a59e7faf9a36b3bb49347c8994" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization" ADD CONSTRAINT "FK_45db25594e621f1629a9fd69b90" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "password_reset" ADD CONSTRAINT "FK_4ef5dc6e585c4f658d8884fa82e" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payment" ADD CONSTRAINT "FK_8a12264602a644a5dbf88af02cc" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "pipeline_stage" ADD CONSTRAINT "FK_08542f025994aa9a22407c09bc8" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "pipeline" ADD CONSTRAINT "FK_79f791ec086b879fd7d7b0b201c" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_category_translation" ADD CONSTRAINT "FK_b1c8e68b0067abbceda37b01a0b" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_category" ADD CONSTRAINT "FK_97654782fc00792c91be4e6f9e5" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_option_group" ADD CONSTRAINT "FK_7fab5bf2913e3588e541e8807e1" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_option_group_translation" ADD CONSTRAINT "FK_c90d321e2429e85bb8d026acac2" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_option_translation" ADD CONSTRAINT "FK_7d5d930340d7d7bd8d3cba9e504" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_option" ADD CONSTRAINT "FK_4dad46f18329c23c6cea6182bd7" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_variant_setting" ADD CONSTRAINT "FK_cba4fd40413428327d9208994b6" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_type_translation" ADD CONSTRAINT "FK_bc8384bd2b0827dc3c63eb2d4ad" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_type" ADD CONSTRAINT "FK_5e105401a2b5687e6dde5ee5e8f" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_variant_price" ADD CONSTRAINT "FK_3e6eb519fadd77025e035cd730a" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_variant" ADD CONSTRAINT "FK_5ed381ac4075f551372738fb95b" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product" ADD CONSTRAINT "FK_3dec567e35053c4016be0cdd51a" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_translation" ADD CONSTRAINT "FK_f44e29486ea5cfcc274f21b096b" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "reaction" ADD CONSTRAINT "FK_d23dd04797a73993b802232dcf7" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "report_category" ADD CONSTRAINT "FK_387a1e44460eeaee8213257e433" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "report_organization" ADD CONSTRAINT "FK_0d5f3f788befd6bd85ccc763999" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "report" ADD CONSTRAINT "FK_de0e1933bf477b6d03793f8c24a" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "request_approval_employee" ADD CONSTRAINT "FK_652566c7bfb3a6264a796bf4e0f" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "request_approval_team" ADD CONSTRAINT "FK_feef79988466a81c461b091e0ca" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "request_approval" ADD CONSTRAINT "FK_2cfc197cc78c994f77574af3887" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "resource_link" ADD CONSTRAINT "FK_4f6120a1ee72177cd1c20171f63" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "role_permission" ADD CONSTRAINT "FK_211933b7bf5d7dfadc3f59ead8b" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "skill" ADD CONSTRAINT "FK_a03a6b79029cfce93965d8710a4" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "entity_subscription" ADD CONSTRAINT "FK_9c48df6f668733aba86e4fc1ee0" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tag" ADD CONSTRAINT "FK_ea1d3cd22e7295ec8565abb0f31" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tag_type" ADD CONSTRAINT "FK_abbfb2e8570aa596de3ec34fbc3" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "daily_plan" ADD CONSTRAINT "FK_73dccc6583e06b46e4ea1657655" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_estimation" ADD CONSTRAINT "FK_87d1283c8acceb61f224d6f524d" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "issue_type" ADD CONSTRAINT "FK_b0b6fd6c28c53dc79291862d715" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task" ADD CONSTRAINT "FK_d03277be13515e98c386d432bcd" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_linked_issues" ADD CONSTRAINT "FK_3c7e566cd87dc3ed06afb3a4cd4" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_priority" ADD CONSTRAINT "FK_88f7144b59d9068645c963bb7fe" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_related_issue_type" ADD CONSTRAINT "FK_845bbcb29db985e512a35809712" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_size" ADD CONSTRAINT "FK_ae9f30be60b2a37fbd6f6449450" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_status" ADD CONSTRAINT "FK_1be690427688d4ad5393c5fb254" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "screening_task" ADD CONSTRAINT "FK_d825a14a0a052dc2aa462ec5568" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_version" ADD CONSTRAINT "FK_1893260d31d65376dc815811251" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task_view" ADD CONSTRAINT "FK_8908342a94b3c246b3721f1ed98" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tenant_api_key" ADD CONSTRAINT "FK_3109be70c53bb955dfd81f4bcf8" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tenant_setting" ADD CONSTRAINT "FK_c6a178bebfadc031aed89c3c487" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tenant" ADD CONSTRAINT "FK_9e6580ac3a746927e959988176f" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_off_policy" ADD CONSTRAINT "FK_d6195ede8e752a3b5196b14c2d9" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_off_request" ADD CONSTRAINT "FK_7b99c26d1cf3418c1c5c56ce7cf" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "activity" ADD CONSTRAINT "FK_a0e09af2ccba1e9a41b05e177b3" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "screenshot" ADD CONSTRAINT "FK_9fc0c7f0224ca55e33c00305810" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_log" ADD CONSTRAINT "FK_4b3d54bc990cb48a2eccac9a282" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_slot" ADD CONSTRAINT "FK_596e0e849822aa09ec0d4a10521" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "time_slot_minute" ADD CONSTRAINT "FK_7b8440953eeff74641d33cc2937" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "timesheet" ADD CONSTRAINT "FK_efb2f5b73f2cd229d9f504800e4" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification" ADD CONSTRAINT "FK_c8eeb269adb12f405d340eb7dee" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification_setting" ADD CONSTRAINT "FK_8c18ac3008773c2f4c7221ac4fd" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "user" ADD CONSTRAINT "FK_f9c50080ce4ebec4adfc88e59b0" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "warehouse_product" ADD CONSTRAINT "FK_713e473a0d6cdff1ddd5a72f942" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "warehouse_product_variant" ADD CONSTRAINT "FK_dcebf5d5ca74f856848bf0b98ed" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "warehouse" ADD CONSTRAINT "FK_d4ca9b0bb898d2fcbf2119b7d1a" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "changelog" ADD CONSTRAINT "FK_d3581ca2376e233c4a13370308d" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository" ADD CONSTRAINT "FK_e07283577a97aec8ab464294e60" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" ADD CONSTRAINT "FK_379156a73559f00aef19004e798" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "proposal" ADD CONSTRAINT "FK_6253b81523c6b60f86ef46502be" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_proposal_template" ADD CONSTRAINT "FK_b4c739f40184262b276c07fb80c" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "job_search_occupation" ADD CONSTRAINT "FK_e73efaf3344565bf6d1a78f6ac8" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "job_search_category" ADD CONSTRAINT "FK_0cdc2fecd8e73bc2ff847bc8292" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_upwork_job_search_criterion" ADD CONSTRAINT "FK_d76576758fff558b566f2d1b14b" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "job_preset" ADD CONSTRAINT "FK_6a753c247307a9e770864ce34ed" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "job_preset_upwork_job_search_criterion" ADD CONSTRAINT "FK_212e610ebfca3c1a55c60105a16" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "knowledge_base" ADD CONSTRAINT "FK_f4d647f99da579f4343925c53c5" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "knowledge_base_article" ADD CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "knowledge_base_author" ADD CONSTRAINT "FK_b5a0a0fb39fafe6eb7d21451bfc" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_review" ADD CONSTRAINT "FK_a13b7839be9f72585c0a9e0833f" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "video" ADD CONSTRAINT "FK_c99fe6b6f9549a9f03c7ed55942" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "video" DROP CONSTRAINT "FK_c99fe6b6f9549a9f03c7ed55942"`);
		await queryRunner.query(`ALTER TABLE "product_review" DROP CONSTRAINT "FK_a13b7839be9f72585c0a9e0833f"`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_author" DROP CONSTRAINT "FK_b5a0a0fb39fafe6eb7d21451bfc"`);
		await queryRunner.query(
			`ALTER TABLE "knowledge_base_article" DROP CONSTRAINT "FK_2de1afe05be78b65ea1d39bdece"`
		);
		await queryRunner.query(`ALTER TABLE "knowledge_base" DROP CONSTRAINT "FK_f4d647f99da579f4343925c53c5"`);
		await queryRunner.query(
			`ALTER TABLE "job_preset_upwork_job_search_criterion" DROP CONSTRAINT "FK_212e610ebfca3c1a55c60105a16"`
		);
		await queryRunner.query(`ALTER TABLE "job_preset" DROP CONSTRAINT "FK_6a753c247307a9e770864ce34ed"`);
		await queryRunner.query(
			`ALTER TABLE "employee_upwork_job_search_criterion" DROP CONSTRAINT "FK_d76576758fff558b566f2d1b14b"`
		);
		await queryRunner.query(`ALTER TABLE "job_search_category" DROP CONSTRAINT "FK_0cdc2fecd8e73bc2ff847bc8292"`);
		await queryRunner.query(`ALTER TABLE "job_search_occupation" DROP CONSTRAINT "FK_e73efaf3344565bf6d1a78f6ac8"`);
		await queryRunner.query(
			`ALTER TABLE "employee_proposal_template" DROP CONSTRAINT "FK_b4c739f40184262b276c07fb80c"`
		);
		await queryRunner.query(`ALTER TABLE "proposal" DROP CONSTRAINT "FK_6253b81523c6b60f86ef46502be"`);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" DROP CONSTRAINT "FK_379156a73559f00aef19004e798"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository" DROP CONSTRAINT "FK_e07283577a97aec8ab464294e60"`
		);
		await queryRunner.query(`ALTER TABLE "changelog" DROP CONSTRAINT "FK_d3581ca2376e233c4a13370308d"`);
		await queryRunner.query(`ALTER TABLE "warehouse" DROP CONSTRAINT "FK_d4ca9b0bb898d2fcbf2119b7d1a"`);
		await queryRunner.query(
			`ALTER TABLE "warehouse_product_variant" DROP CONSTRAINT "FK_dcebf5d5ca74f856848bf0b98ed"`
		);
		await queryRunner.query(`ALTER TABLE "warehouse_product" DROP CONSTRAINT "FK_713e473a0d6cdff1ddd5a72f942"`);
		await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_f9c50080ce4ebec4adfc88e59b0"`);
		await queryRunner.query(
			`ALTER TABLE "employee_notification_setting" DROP CONSTRAINT "FK_8c18ac3008773c2f4c7221ac4fd"`
		);
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP CONSTRAINT "FK_c8eeb269adb12f405d340eb7dee"`);
		await queryRunner.query(`ALTER TABLE "timesheet" DROP CONSTRAINT "FK_efb2f5b73f2cd229d9f504800e4"`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" DROP CONSTRAINT "FK_7b8440953eeff74641d33cc2937"`);
		await queryRunner.query(`ALTER TABLE "time_slot" DROP CONSTRAINT "FK_596e0e849822aa09ec0d4a10521"`);
		await queryRunner.query(`ALTER TABLE "time_log" DROP CONSTRAINT "FK_4b3d54bc990cb48a2eccac9a282"`);
		await queryRunner.query(`ALTER TABLE "screenshot" DROP CONSTRAINT "FK_9fc0c7f0224ca55e33c00305810"`);
		await queryRunner.query(`ALTER TABLE "activity" DROP CONSTRAINT "FK_a0e09af2ccba1e9a41b05e177b3"`);
		await queryRunner.query(`ALTER TABLE "time_off_request" DROP CONSTRAINT "FK_7b99c26d1cf3418c1c5c56ce7cf"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP CONSTRAINT "FK_d6195ede8e752a3b5196b14c2d9"`);
		await queryRunner.query(`ALTER TABLE "tenant" DROP CONSTRAINT "FK_9e6580ac3a746927e959988176f"`);
		await queryRunner.query(`ALTER TABLE "tenant_setting" DROP CONSTRAINT "FK_c6a178bebfadc031aed89c3c487"`);
		await queryRunner.query(`ALTER TABLE "tenant_api_key" DROP CONSTRAINT "FK_3109be70c53bb955dfd81f4bcf8"`);
		await queryRunner.query(`ALTER TABLE "task_view" DROP CONSTRAINT "FK_8908342a94b3c246b3721f1ed98"`);
		await queryRunner.query(`ALTER TABLE "task_version" DROP CONSTRAINT "FK_1893260d31d65376dc815811251"`);
		await queryRunner.query(`ALTER TABLE "screening_task" DROP CONSTRAINT "FK_d825a14a0a052dc2aa462ec5568"`);
		await queryRunner.query(`ALTER TABLE "task_status" DROP CONSTRAINT "FK_1be690427688d4ad5393c5fb254"`);
		await queryRunner.query(`ALTER TABLE "task_size" DROP CONSTRAINT "FK_ae9f30be60b2a37fbd6f6449450"`);
		await queryRunner.query(
			`ALTER TABLE "task_related_issue_type" DROP CONSTRAINT "FK_845bbcb29db985e512a35809712"`
		);
		await queryRunner.query(`ALTER TABLE "task_priority" DROP CONSTRAINT "FK_88f7144b59d9068645c963bb7fe"`);
		await queryRunner.query(`ALTER TABLE "task_linked_issues" DROP CONSTRAINT "FK_3c7e566cd87dc3ed06afb3a4cd4"`);
		await queryRunner.query(`ALTER TABLE "task" DROP CONSTRAINT "FK_d03277be13515e98c386d432bcd"`);
		await queryRunner.query(`ALTER TABLE "issue_type" DROP CONSTRAINT "FK_b0b6fd6c28c53dc79291862d715"`);
		await queryRunner.query(`ALTER TABLE "task_estimation" DROP CONSTRAINT "FK_87d1283c8acceb61f224d6f524d"`);
		await queryRunner.query(`ALTER TABLE "daily_plan" DROP CONSTRAINT "FK_73dccc6583e06b46e4ea1657655"`);
		await queryRunner.query(`ALTER TABLE "tag_type" DROP CONSTRAINT "FK_abbfb2e8570aa596de3ec34fbc3"`);
		await queryRunner.query(`ALTER TABLE "tag" DROP CONSTRAINT "FK_ea1d3cd22e7295ec8565abb0f31"`);
		await queryRunner.query(`ALTER TABLE "entity_subscription" DROP CONSTRAINT "FK_9c48df6f668733aba86e4fc1ee0"`);
		await queryRunner.query(`ALTER TABLE "skill" DROP CONSTRAINT "FK_a03a6b79029cfce93965d8710a4"`);
		await queryRunner.query(`ALTER TABLE "role_permission" DROP CONSTRAINT "FK_211933b7bf5d7dfadc3f59ead8b"`);
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_4f6120a1ee72177cd1c20171f63"`);
		await queryRunner.query(`ALTER TABLE "request_approval" DROP CONSTRAINT "FK_2cfc197cc78c994f77574af3887"`);
		await queryRunner.query(`ALTER TABLE "request_approval_team" DROP CONSTRAINT "FK_feef79988466a81c461b091e0ca"`);
		await queryRunner.query(
			`ALTER TABLE "request_approval_employee" DROP CONSTRAINT "FK_652566c7bfb3a6264a796bf4e0f"`
		);
		await queryRunner.query(`ALTER TABLE "report" DROP CONSTRAINT "FK_de0e1933bf477b6d03793f8c24a"`);
		await queryRunner.query(`ALTER TABLE "report_organization" DROP CONSTRAINT "FK_0d5f3f788befd6bd85ccc763999"`);
		await queryRunner.query(`ALTER TABLE "report_category" DROP CONSTRAINT "FK_387a1e44460eeaee8213257e433"`);
		await queryRunner.query(`ALTER TABLE "reaction" DROP CONSTRAINT "FK_d23dd04797a73993b802232dcf7"`);
		await queryRunner.query(`ALTER TABLE "product_translation" DROP CONSTRAINT "FK_f44e29486ea5cfcc274f21b096b"`);
		await queryRunner.query(`ALTER TABLE "product" DROP CONSTRAINT "FK_3dec567e35053c4016be0cdd51a"`);
		await queryRunner.query(`ALTER TABLE "product_variant" DROP CONSTRAINT "FK_5ed381ac4075f551372738fb95b"`);
		await queryRunner.query(`ALTER TABLE "product_variant_price" DROP CONSTRAINT "FK_3e6eb519fadd77025e035cd730a"`);
		await queryRunner.query(`ALTER TABLE "product_type" DROP CONSTRAINT "FK_5e105401a2b5687e6dde5ee5e8f"`);
		await queryRunner.query(
			`ALTER TABLE "product_type_translation" DROP CONSTRAINT "FK_bc8384bd2b0827dc3c63eb2d4ad"`
		);
		await queryRunner.query(
			`ALTER TABLE "product_variant_setting" DROP CONSTRAINT "FK_cba4fd40413428327d9208994b6"`
		);
		await queryRunner.query(`ALTER TABLE "product_option" DROP CONSTRAINT "FK_4dad46f18329c23c6cea6182bd7"`);
		await queryRunner.query(
			`ALTER TABLE "product_option_translation" DROP CONSTRAINT "FK_7d5d930340d7d7bd8d3cba9e504"`
		);
		await queryRunner.query(
			`ALTER TABLE "product_option_group_translation" DROP CONSTRAINT "FK_c90d321e2429e85bb8d026acac2"`
		);
		await queryRunner.query(`ALTER TABLE "product_option_group" DROP CONSTRAINT "FK_7fab5bf2913e3588e541e8807e1"`);
		await queryRunner.query(`ALTER TABLE "product_category" DROP CONSTRAINT "FK_97654782fc00792c91be4e6f9e5"`);
		await queryRunner.query(
			`ALTER TABLE "product_category_translation" DROP CONSTRAINT "FK_b1c8e68b0067abbceda37b01a0b"`
		);
		await queryRunner.query(`ALTER TABLE "pipeline" DROP CONSTRAINT "FK_79f791ec086b879fd7d7b0b201c"`);
		await queryRunner.query(`ALTER TABLE "pipeline_stage" DROP CONSTRAINT "FK_08542f025994aa9a22407c09bc8"`);
		await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_8a12264602a644a5dbf88af02cc"`);
		await queryRunner.query(`ALTER TABLE "password_reset" DROP CONSTRAINT "FK_4ef5dc6e585c4f658d8884fa82e"`);
		await queryRunner.query(`ALTER TABLE "organization" DROP CONSTRAINT "FK_45db25594e621f1629a9fd69b90"`);
		await queryRunner.query(`ALTER TABLE "organization_vendor" DROP CONSTRAINT "FK_0a59e7faf9a36b3bb49347c8994"`);
		await queryRunner.query(
			`ALTER TABLE "organization_team_join_request" DROP CONSTRAINT "FK_00501fd8af5665fa26f0f32c496"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_team_employee" DROP CONSTRAINT "FK_9549570d7d36cdf6573a789d1ec"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_task_setting" DROP CONSTRAINT "FK_cd4cac293f59c15f401291fd3f9"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task_history" DROP CONSTRAINT "FK_8c6fb3a3f58bb321e123f380312"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_task" DROP CONSTRAINT "FK_5b93842b83905b53c2351f4f44b"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_sprint_employee" DROP CONSTRAINT "FK_9f6c5bde23442aed91b7ab15cbb"`
		);
		await queryRunner.query(`ALTER TABLE "organization_sprint" DROP CONSTRAINT "FK_b780e14e4440b83f90b2113b646"`);
		await queryRunner.query(
			`ALTER TABLE "organization_recurring_expense" DROP CONSTRAINT "FK_6f63f6aed0ee00d9ada113ef597"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" DROP CONSTRAINT "FK_6b432fbf56ca3d370bf701c6486"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_e54a0863352454bff7b5f440145"`
		);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP CONSTRAINT "FK_47da91256516fc5f08685638fca"`);
		await queryRunner.query(`ALTER TABLE "organization_position" DROP CONSTRAINT "FK_6a2de803ef353e1bd4128d5615f"`);
		await queryRunner.query(`ALTER TABLE "organization_language" DROP CONSTRAINT "FK_89c53c0ee5dd2e4f81c63c119d4"`);
		await queryRunner.query(
			`ALTER TABLE "organization_employment_type" DROP CONSTRAINT "FK_0c80b521c633f26288742c068e7"`
		);
		await queryRunner.query(`ALTER TABLE "organization_document" DROP CONSTRAINT "FK_867d292707b49ebd6c2fda01230"`);
		await queryRunner.query(
			`ALTER TABLE "organization_department" DROP CONSTRAINT "FK_5b637516c71c62ebe60dac24346"`
		);
		await queryRunner.query(`ALTER TABLE "organization_contact" DROP CONSTRAINT "FK_b5589e035e86d23ebb54ea2728c"`);
		await queryRunner.query(`ALTER TABLE "organization_award" DROP CONSTRAINT "FK_365dc87b5f0c60ee03b15d85576"`);
		await queryRunner.query(`ALTER TABLE "merchant" DROP CONSTRAINT "FK_d8c4b846300725c505b363d7e34"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_d467a0f5bca6530c44ec544bb84"`);
		await queryRunner.query(`ALTER TABLE "language" DROP CONSTRAINT "FK_ab2ad73ac5e4e012f6e9e4e21f9"`);
		await queryRunner.query(`ALTER TABLE "key_result" DROP CONSTRAINT "FK_b6615253c8f84ff3c8ceeebcbe0"`);
		await queryRunner.query(`ALTER TABLE "key_result_update" DROP CONSTRAINT "FK_fd4535b4cf367f4d9b534c16496"`);
		await queryRunner.query(`ALTER TABLE "key_result_template" DROP CONSTRAINT "FK_512eefd7a11a4d4e68f57927650"`);
		await queryRunner.query(`ALTER TABLE "invoice" DROP CONSTRAINT "FK_b582db7d0602a1efa7d5dfa288e"`);
		await queryRunner.query(`ALTER TABLE "invoice_item" DROP CONSTRAINT "FK_178c0bc8e33361149d4a618cca7"`);
		await queryRunner.query(
			`ALTER TABLE "invoice_estimate_history" DROP CONSTRAINT "FK_e7eed755eb0abffee4947493406"`
		);
		await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "FK_9bc9bb57684fe5963713e21c7c8"`);
		await queryRunner.query(`ALTER TABLE "integration" DROP CONSTRAINT "FK_71cbe9d1b57e634e54cd68e76af"`);
		await queryRunner.query(`ALTER TABLE "integration_type" DROP CONSTRAINT "FK_9a5e5dabfb6a5cbb34ed47d1a59"`);
		await queryRunner.query(`ALTER TABLE "integration_tenant" DROP CONSTRAINT "FK_c4ff91d235c28a016ed8ab76cd3"`);
		await queryRunner.query(`ALTER TABLE "integration_setting" DROP CONSTRAINT "FK_1a60b1bc334fed4146975d845ed"`);
		await queryRunner.query(`ALTER TABLE "integration_map" DROP CONSTRAINT "FK_d253b06f6a6d0a855c287577b84"`);
		await queryRunner.query(
			`ALTER TABLE "integration_entity_setting" DROP CONSTRAINT "FK_9e92d430204b7ff0eecc605d4d0"`
		);
		await queryRunner.query(
			`ALTER TABLE "integration_entity_setting_tied" DROP CONSTRAINT "FK_113a95aed26eddd1e8d40b0cddb"`
		);
		await queryRunner.query(`ALTER TABLE "income" DROP CONSTRAINT "FK_08b846d2460414b4759af81e29b"`);
		await queryRunner.query(`ALTER TABLE "image_asset" DROP CONSTRAINT "FK_2dee121e5b374c1119bd3d1e1e6"`);
		await queryRunner.query(`ALTER TABLE "goal" DROP CONSTRAINT "FK_ead8dd87bf3c1fc2d1209e87509"`);
		await queryRunner.query(`ALTER TABLE "goal_time_frame" DROP CONSTRAINT "FK_3990c91c89a9b9f3fe87749dd60"`);
		await queryRunner.query(`ALTER TABLE "goal_template" DROP CONSTRAINT "FK_a955cdbcb58f825f98920901d08"`);
		await queryRunner.query(`ALTER TABLE "goal_kpi" DROP CONSTRAINT "FK_b1466682a92d94f52828c455c54"`);
		await queryRunner.query(`ALTER TABLE "goal_kpi_template" DROP CONSTRAINT "FK_ee45ea5731ea86d7696f939161a"`);
		await queryRunner.query(`ALTER TABLE "goal_general_setting" DROP CONSTRAINT "FK_dcbfa613c99c3f1f43d74516286"`);
		await queryRunner.query(`ALTER TABLE "feature" DROP CONSTRAINT "FK_c78a64011be11f508bb87092949"`);
		await queryRunner.query(`ALTER TABLE "feature_organization" DROP CONSTRAINT "FK_a42c48c66f2869dfc147592bd7c"`);
		await queryRunner.query(`ALTER TABLE "favorite" DROP CONSTRAINT "FK_2d50654571fd3a340cea1b94510"`);
		await queryRunner.query(`ALTER TABLE "import-record" DROP CONSTRAINT "FK_bea5edb25eb095cfdda34ba2d7b"`);
		await queryRunner.query(`ALTER TABLE "import-history" DROP CONSTRAINT "FK_1fd9a775532f8c4ab92fb72f0cd"`);
		await queryRunner.query(`ALTER TABLE "expense" DROP CONSTRAINT "FK_96a658f575c481d643df9958c1c"`);
		await queryRunner.query(`ALTER TABLE "event_type" DROP CONSTRAINT "FK_c901b00ed3d38800aad213bda19"`);
		await queryRunner.query(`ALTER TABLE "estimate_email" DROP CONSTRAINT "FK_795436e5d26674b5453efb1eb64"`);
		await queryRunner.query(`ALTER TABLE "equipment" DROP CONSTRAINT "FK_f719e1059ace526782444687c48"`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing" DROP CONSTRAINT "FK_3febe3cf1c4c2809555fe43eac2"`);
		await queryRunner.query(
			`ALTER TABLE "equipment_sharing_policy" DROP CONSTRAINT "FK_33d5df882f543656ab0541b967b"`
		);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP CONSTRAINT "FK_846fee0cd2137ceb78dc706389a"`);
		await queryRunner.query(
			`ALTER TABLE "employee_recurring_expense" DROP CONSTRAINT "FK_7881998f1f0c4f7f9c9d79c9d44"`
		);
		await queryRunner.query(`ALTER TABLE "employee_phone" DROP CONSTRAINT "FK_bd2d935878e5f2484a71a4113e2"`);
		await queryRunner.query(`ALTER TABLE "employee_level" DROP CONSTRAINT "FK_bf78c02426d1eadce7e83d18245"`);
		await queryRunner.query(`ALTER TABLE "employee_award" DROP CONSTRAINT "FK_9166913ec7d1e78680cd5e56b79"`);
		await queryRunner.query(`ALTER TABLE "employee_availability" DROP CONSTRAINT "FK_8a3c8f83011c7ecdaeebcd7af72"`);
		await queryRunner.query(`ALTER TABLE "employee_appointment" DROP CONSTRAINT "FK_299134c31638857b2d0689705ae"`);
		await queryRunner.query(`ALTER TABLE "email_template" DROP CONSTRAINT "FK_7f38e534c5759d2baa11a82aa03"`);
		await queryRunner.query(`ALTER TABLE "email_reset" DROP CONSTRAINT "FK_9441f1450d2890cb2d23e90c011"`);
		await queryRunner.query(`ALTER TABLE "email_sent" DROP CONSTRAINT "FK_27586579b266385efd6fb18e3ae"`);
		await queryRunner.query(`ALTER TABLE "deal" DROP CONSTRAINT "FK_8fa563577e08a3256f9aeee690c"`);
		await queryRunner.query(`ALTER TABLE "dashboard_widget" DROP CONSTRAINT "FK_b704dccd38e97a55cc9deac2d28"`);
		await queryRunner.query(`ALTER TABLE "dashboard" DROP CONSTRAINT "FK_643064af20f4f527b729779d753"`);
		await queryRunner.query(`ALTER TABLE "organization_team" DROP CONSTRAINT "FK_e39d0402881bf9e8ac8a129fdc5"`);
		await queryRunner.query(`ALTER TABLE "role" DROP CONSTRAINT "FK_6c088cf682d0a4bb735ccb0a311"`);
		await queryRunner.query(`ALTER TABLE "user_organization" DROP CONSTRAINT "FK_a314c29d571530288e96975a685"`);
		await queryRunner.query(`ALTER TABLE "expense_category" DROP CONSTRAINT "FK_6172dc1ac8a2cf15973729ed6bd"`);
		await queryRunner.query(`ALTER TABLE "employee" DROP CONSTRAINT "FK_ddf5990b253db3ec7b333721312"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module_employee" DROP CONSTRAINT "FK_4bf84ab2b3849938c6334b7ddc3"`
		);
		await queryRunner.query(`ALTER TABLE "custom_smtp" DROP CONSTRAINT "FK_976b259192623317acb4de599b1"`);
		await queryRunner.query(`ALTER TABLE "currency" DROP CONSTRAINT "FK_7377648bc23791951ef83b545ee"`);
		await queryRunner.query(`ALTER TABLE "country" DROP CONSTRAINT "FK_1f6217f158acf9d7d3b993590b9"`);
		await queryRunner.query(`ALTER TABLE "contact" DROP CONSTRAINT "FK_17b84c194e13003bfbd4a689120"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_fe1c3155e4949897eb8b1b756fb"`);
		await queryRunner.query(`ALTER TABLE "candidate" DROP CONSTRAINT "FK_17a855d8deaf639785432194248"`);
		await queryRunner.query(`ALTER TABLE "candidate_technology" DROP CONSTRAINT "FK_5f004c022c6c17f80f2fa8d9079"`);
		await queryRunner.query(`ALTER TABLE "candidate_source" DROP CONSTRAINT "FK_672fa2e19cc9fce4d2b9220086c"`);
		await queryRunner.query(`ALTER TABLE "candidate_skill" DROP CONSTRAINT "FK_f4eaebf487ecf05252ec96ad2c5"`);
		await queryRunner.query(
			`ALTER TABLE "candidate_personal_quality" DROP CONSTRAINT "FK_4a66ef05e825cb5a4a509ef057d"`
		);
		await queryRunner.query(`ALTER TABLE "candidate_interviewer" DROP CONSTRAINT "FK_6a62665e2734dd2862bf6719291"`);
		await queryRunner.query(`ALTER TABLE "candidate_interview" DROP CONSTRAINT "FK_baef43f2381ec9eaaeb4bbbc833"`);
		await queryRunner.query(`ALTER TABLE "candidate_feedback" DROP CONSTRAINT "FK_0f0243b797e624641e53224376a"`);
		await queryRunner.query(`ALTER TABLE "candidate_experience" DROP CONSTRAINT "FK_789ccc968b2020ef24bcda7c9e5"`);
		await queryRunner.query(`ALTER TABLE "candidate_education" DROP CONSTRAINT "FK_8c530c2dc676e52e425b66b53ef"`);
		await queryRunner.query(`ALTER TABLE "candidate_document" DROP CONSTRAINT "FK_4e61633a96e9f4b10fecc33db7e"`);
		await queryRunner.query(
			`ALTER TABLE "candidate_criterion_rating" DROP CONSTRAINT "FK_b695a0ff1ab63e9284f98d842cb"`
		);
		await queryRunner.query(`ALTER TABLE "social_account" DROP CONSTRAINT "FK_c00ab1a0e2c2fe377f31a3402a3"`);
		await queryRunner.query(`ALTER TABLE "availability_slot" DROP CONSTRAINT "FK_4aac964a16662fab059709e2bb9"`);
		await queryRunner.query(`ALTER TABLE "approval_policy" DROP CONSTRAINT "FK_a67fd3563d00880f76f00c3a2fc"`);
		await queryRunner.query(`ALTER TABLE "appointment_employee" DROP CONSTRAINT "FK_04cca678432d8744940387d169f"`);
		await queryRunner.query(`ALTER TABLE "api_call_log" DROP CONSTRAINT "FK_0ad05fd38874b34aa850d6aa7d0"`);
		await queryRunner.query(`ALTER TABLE "activity_log" DROP CONSTRAINT "FK_f7ed7ad3403e192654b46744b7d"`);
		await queryRunner.query(`ALTER TABLE "accounting_template" DROP CONSTRAINT "FK_cef191a5d39cba98f436a3426e2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c99fe6b6f9549a9f03c7ed5594"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a13b7839be9f72585c0a9e0833"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b5a0a0fb39fafe6eb7d21451bf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2de1afe05be78b65ea1d39bdec"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f4d647f99da579f4343925c53c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_212e610ebfca3c1a55c60105a1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6a753c247307a9e770864ce34e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d76576758fff558b566f2d1b14"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0cdc2fecd8e73bc2ff847bc829"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e73efaf3344565bf6d1a78f6ac"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b4c739f40184262b276c07fb80"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6253b81523c6b60f86ef46502b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_379156a73559f00aef19004e79"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e07283577a97aec8ab464294e6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d3581ca2376e233c4a13370308"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d4ca9b0bb898d2fcbf2119b7d1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_dcebf5d5ca74f856848bf0b98e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_713e473a0d6cdff1ddd5a72f94"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f9c50080ce4ebec4adfc88e59b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8c18ac3008773c2f4c7221ac4f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c8eeb269adb12f405d340eb7de"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_efb2f5b73f2cd229d9f504800e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7b8440953eeff74641d33cc293"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_596e0e849822aa09ec0d4a1052"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4b3d54bc990cb48a2eccac9a28"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9fc0c7f0224ca55e33c0030581"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a0e09af2ccba1e9a41b05e177b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7b99c26d1cf3418c1c5c56ce7c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d6195ede8e752a3b5196b14c2d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9e6580ac3a746927e959988176"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c6a178bebfadc031aed89c3c48"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3109be70c53bb955dfd81f4bcf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8908342a94b3c246b3721f1ed9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1893260d31d65376dc81581125"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d825a14a0a052dc2aa462ec556"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1be690427688d4ad5393c5fb25"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ae9f30be60b2a37fbd6f644945"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_845bbcb29db985e512a3580971"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_88f7144b59d9068645c963bb7f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3c7e566cd87dc3ed06afb3a4cd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d03277be13515e98c386d432bc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b0b6fd6c28c53dc79291862d71"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_87d1283c8acceb61f224d6f524"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_73dccc6583e06b46e4ea165765"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_abbfb2e8570aa596de3ec34fbc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ea1d3cd22e7295ec8565abb0f3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9c48df6f668733aba86e4fc1ee"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a03a6b79029cfce93965d8710a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_211933b7bf5d7dfadc3f59ead8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4f6120a1ee72177cd1c20171f6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2cfc197cc78c994f77574af388"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_feef79988466a81c461b091e0c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_652566c7bfb3a6264a796bf4e0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_de0e1933bf477b6d03793f8c24"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0d5f3f788befd6bd85ccc76399"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_387a1e44460eeaee8213257e43"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d23dd04797a73993b802232dcf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f44e29486ea5cfcc274f21b096"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3dec567e35053c4016be0cdd51"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5ed381ac4075f551372738fb95"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3e6eb519fadd77025e035cd730"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5e105401a2b5687e6dde5ee5e8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bc8384bd2b0827dc3c63eb2d4a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cba4fd40413428327d9208994b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4dad46f18329c23c6cea6182bd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7d5d930340d7d7bd8d3cba9e50"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c90d321e2429e85bb8d026acac"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7fab5bf2913e3588e541e8807e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_97654782fc00792c91be4e6f9e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b1c8e68b0067abbceda37b01a0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_79f791ec086b879fd7d7b0b201"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_08542f025994aa9a22407c09bc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8a12264602a644a5dbf88af02c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4ef5dc6e585c4f658d8884fa82"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_45db25594e621f1629a9fd69b9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0a59e7faf9a36b3bb49347c899"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_00501fd8af5665fa26f0f32c49"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9549570d7d36cdf6573a789d1e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cd4cac293f59c15f401291fd3f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8c6fb3a3f58bb321e123f38031"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5b93842b83905b53c2351f4f44"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9f6c5bde23442aed91b7ab15cb"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b780e14e4440b83f90b2113b64"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6f63f6aed0ee00d9ada113ef59"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6b432fbf56ca3d370bf701c648"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e54a0863352454bff7b5f44014"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_47da91256516fc5f08685638fc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6a2de803ef353e1bd4128d5615"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_89c53c0ee5dd2e4f81c63c119d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0c80b521c633f26288742c068e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_867d292707b49ebd6c2fda0123"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5b637516c71c62ebe60dac2434"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b5589e035e86d23ebb54ea2728"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_365dc87b5f0c60ee03b15d8557"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d8c4b846300725c505b363d7e3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d467a0f5bca6530c44ec544bb8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ab2ad73ac5e4e012f6e9e4e21f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b6615253c8f84ff3c8ceeebcbe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fd4535b4cf367f4d9b534c1649"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_512eefd7a11a4d4e68f5792765"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b582db7d0602a1efa7d5dfa288"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_178c0bc8e33361149d4a618cca"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e7eed755eb0abffee494749340"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9bc9bb57684fe5963713e21c7c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_71cbe9d1b57e634e54cd68e76a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9a5e5dabfb6a5cbb34ed47d1a5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c4ff91d235c28a016ed8ab76cd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1a60b1bc334fed4146975d845e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d253b06f6a6d0a855c287577b8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9e92d430204b7ff0eecc605d4d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_113a95aed26eddd1e8d40b0cdd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_08b846d2460414b4759af81e29"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2dee121e5b374c1119bd3d1e1e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ead8dd87bf3c1fc2d1209e8750"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3990c91c89a9b9f3fe87749dd6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a955cdbcb58f825f98920901d0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b1466682a92d94f52828c455c5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ee45ea5731ea86d7696f939161"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_dcbfa613c99c3f1f43d7451628"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c78a64011be11f508bb8709294"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a42c48c66f2869dfc147592bd7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2d50654571fd3a340cea1b9451"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bea5edb25eb095cfdda34ba2d7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1fd9a775532f8c4ab92fb72f0c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_96a658f575c481d643df9958c1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c901b00ed3d38800aad213bda1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_795436e5d26674b5453efb1eb6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f719e1059ace526782444687c4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3febe3cf1c4c2809555fe43eac"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_33d5df882f543656ab0541b967"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_846fee0cd2137ceb78dc706389"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7881998f1f0c4f7f9c9d79c9d4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bd2d935878e5f2484a71a4113e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bf78c02426d1eadce7e83d1824"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9166913ec7d1e78680cd5e56b7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8a3c8f83011c7ecdaeebcd7af7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_299134c31638857b2d0689705a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7f38e534c5759d2baa11a82aa0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9441f1450d2890cb2d23e90c01"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_27586579b266385efd6fb18e3a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8fa563577e08a3256f9aeee690"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b704dccd38e97a55cc9deac2d2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_643064af20f4f527b729779d75"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e39d0402881bf9e8ac8a129fdc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6c088cf682d0a4bb735ccb0a31"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a314c29d571530288e96975a68"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6172dc1ac8a2cf15973729ed6b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ddf5990b253db3ec7b33372131"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4bf84ab2b3849938c6334b7ddc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_976b259192623317acb4de599b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7377648bc23791951ef83b545e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1f6217f158acf9d7d3b993590b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_17b84c194e13003bfbd4a68912"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fe1c3155e4949897eb8b1b756f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_17a855d8deaf63978543219424"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5f004c022c6c17f80f2fa8d907"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_672fa2e19cc9fce4d2b9220086"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f4eaebf487ecf05252ec96ad2c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4a66ef05e825cb5a4a509ef057"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6a62665e2734dd2862bf671929"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_baef43f2381ec9eaaeb4bbbc83"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0f0243b797e624641e53224376"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_789ccc968b2020ef24bcda7c9e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8c530c2dc676e52e425b66b53e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4e61633a96e9f4b10fecc33db7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b695a0ff1ab63e9284f98d842c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c00ab1a0e2c2fe377f31a3402a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4aac964a16662fab059709e2bb"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a67fd3563d00880f76f00c3a2f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_04cca678432d8744940387d169"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0ad05fd38874b34aa850d6aa7d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f7ed7ad3403e192654b46744b7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cef191a5d39cba98f436a3426e"`);
		await queryRunner.query(`ALTER TABLE "video" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_review" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_author" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "knowledge_base" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "job_preset_upwork_job_search_criterion" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "job_preset" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_upwork_job_search_criterion" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "job_search_category" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "job_search_occupation" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_proposal_template" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "proposal" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_github_repository_issue" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_github_repository" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "changelog" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "warehouse" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_notification_setting" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "timesheet" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "time_slot" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "time_log" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "screenshot" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "activity" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "time_off_request" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "tenant" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "tenant_setting" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "tenant_api_key" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_view" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_version" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "screening_task" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_status" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_size" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_related_issue_type" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_priority" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_linked_issues" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "issue_type" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "task_estimation" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "daily_plan" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "tag_type" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "tag" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "entity_subscription" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "role_permission" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "resource_link" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "request_approval" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "request_approval_team" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "request_approval_employee" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "report" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "report_organization" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "report_category" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "reaction" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_translation" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_variant_price" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_type" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_type_translation" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_variant_setting" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_option" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_option_translation" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_option_group_translation" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_option_group" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_category" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "product_category_translation" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "pipeline" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "pipeline_stage" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "password_reset" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_vendor" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_team_join_request" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_team_employee" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_task_setting" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_sprint_task_history" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_sprint_task" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_sprint_employee" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_sprint" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_recurring_expense" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_module" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_position" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_language" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_employment_type" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_document" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_department" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_contact" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_award" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "merchant" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "language" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "key_result" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "key_result_update" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "key_result_template" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "invoice_item" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "invoice_estimate_history" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "invite" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration_type" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration_tenant" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration_setting" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration_map" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration_entity_setting" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "integration_entity_setting_tied" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "income" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "image_asset" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "goal" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "goal_time_frame" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "goal_template" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "goal_kpi" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "goal_kpi_template" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "goal_general_setting" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "feature" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "feature_organization" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "favorite" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "import-record" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "import-history" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "expense" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "event_type" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "estimate_email" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "equipment" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing_policy" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_recurring_expense" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_phone" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_level" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_award" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_availability" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee_appointment" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "email_template" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "email_reset" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "email_sent" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "deal" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "dashboard_widget" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "dashboard" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_team" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "user_organization" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "expense_category" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "employee" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_module_employee" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "custom_smtp" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "currency" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "country" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "contact" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_technology" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_source" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_skill" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_personal_quality" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_interviewer" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_interview" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_feedback" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_experience" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_education" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_document" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "candidate_criterion_rating" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "social_account" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "availability_slot" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "approval_policy" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "appointment_employee" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "api_call_log" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "activity_log" DROP COLUMN "updatedByUserId"`);
		await queryRunner.query(`ALTER TABLE "accounting_template" DROP COLUMN "updatedByUserId"`);
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
