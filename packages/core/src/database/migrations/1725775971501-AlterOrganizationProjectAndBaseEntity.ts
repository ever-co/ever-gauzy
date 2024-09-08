import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterOrganizationProjectAndBaseEntity1725775971501 implements MigrationInterface {
	name = 'AlterOrganizationProjectAndBaseEntity1725775971501';

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
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "accounting_template" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "appointment_employee" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "approval_policy" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "availability_slot" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "social_account" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "candidate_criterion_rating" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "candidate_document" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "candidate_education" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "candidate_experience" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "candidate_feedback" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "candidate_interview" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "candidate_interviewer" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "candidate_personal_quality" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "candidate_skill" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "candidate_source" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "candidate_technology" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "candidate" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "contact" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "country" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "currency" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "custom_smtp" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "deal" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "email_sent" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "email_reset" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "email_template" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "employee_appointment" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "employee_award" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "employee_level" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "employee_phone" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "employee_recurring_expense" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "employee" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing_policy" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "equipment" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "estimate_email" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "event_type" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "expense_category" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "expense" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "import-history" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "import-record" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "feature_organization" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "feature" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "goal_general_setting" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "goal_kpi_template" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "goal_kpi" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "goal_template" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "goal_time_frame" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "goal" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "image_asset" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "income" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "integration_entity_setting_tied" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "integration_entity_setting" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "integration_map" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "integration_setting" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "integration_tenant" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "integration_type" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "integration" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "invite" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "invoice_estimate_history" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "invoice_item" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "invoice" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "key_result_template" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "key_result_update" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "key_result" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "language" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "merchant" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_award" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_contact" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_department" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_document" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_employment_type" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_language" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_position" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "status" character varying`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "icon" character varying`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "archiveTasksIn" numeric`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "closeTasksIn" numeric`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "managerId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project" ADD "defaultAssigneeId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_module" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_recurring_expense" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_sprint" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_task_setting" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_team_employee" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_team_join_request" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_team" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_vendor" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "password_reset" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "payment" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "pipeline_stage" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "pipeline" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product_category_translation" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product_category" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product_option_group" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product_option_group_translation" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product_option_translation" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product_option" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product_variant_setting" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product_type_translation" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product_type" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product_variant_price" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product_variant" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product_translation" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "report_category" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "report_organization" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "report" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "request_approval_employee" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "request_approval_team" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "request_approval" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "role_permission" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "role" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "skill" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "tag" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "daily_plan" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "task_estimation" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "issue_type" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "task" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "task_linked_issues" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "task_priority" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "task_related_issue_type" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "task_size" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "task_status" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "task_version" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "tenant_setting" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "tenant" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "time_off_request" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "activity" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "screenshot" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "time_log" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "time_slot" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "timesheet" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "user_organization" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "user" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "warehouse_product" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "warehouse" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "changelog" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_github_repository" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_github_repository_issue" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "proposal" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "employee_proposal_template" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "job_search_occupation" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "job_search_category" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "employee_upwork_job_search_criterion" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "job_preset" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "job_preset_upwork_job_search_criterion" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "knowledge_base" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_article" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_author" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "product_review" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(
			`CREATE INDEX "IDX_5d74a3f25e6acfb6caec05ec65" ON "accounting_template" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e0c6443e0d2d5630067bc10ccf" ON "appointment_employee" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_829e02292a572f25476c4e426c" ON "approval_policy" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_2ada776a231239b8e99f78bf64" ON "availability_slot" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_c323aa830e10a871854d0a0408" ON "social_account" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_75bd5526e43c8801085225ffa9" ON "candidate_criterion_rating" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4985a92870282574f6fec8dd98" ON "candidate_document" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_745780f5553e56a3ca19bccf86" ON "candidate_education" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bb09aa3130d0e54007a98523c5" ON "candidate_experience" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_89ff7e0a8c37fdf7770b753776" ON "candidate_feedback" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_09f72a1a309aae91e0cd83949a" ON "candidate_interview" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_54b281d06e1a4e7e6ff640dab4" ON "candidate_interviewer" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fa411cb89c9c6848d192d7f2e6" ON "candidate_personal_quality" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f651e72ab42727f28c29441f1b" ON "candidate_skill" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_df0a9a4b6ae0e3cab9c4f35436" ON "candidate_source" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_5cb080756923318f19f1d2eabe" ON "candidate_technology" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_ac765cfc390ec77d765dd48b61" ON "candidate" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_67a4423093e3c311cb76275659" ON "contact" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_711fd0159178a0102abc4db336" ON "country" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_e99bb270f0fa89ea715a457d29" ON "currency" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_36106478339961c8a17674a031" ON "custom_smtp" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_284658fe519bca6048fd73ff72" ON "deal" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_753f4b022ec98a0c8f38b370c0" ON "email_sent" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_35ac91a92c521b68277e780e6e" ON "email_reset" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_ce96229ae8d1d1af61348730da" ON "email_template" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e69d60f1adcded4445095c4787" ON "employee_appointment" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_cee87c9b8743f0e81db8152f68" ON "employee_award" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_9dff154a1be222c66c179ad14b" ON "employee_level" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_08e391262cb3d4fbe9db97ecf8" ON "employee_phone" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_185b880550575c61d4212896e2" ON "employee_recurring_expense" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a8e048dfb4d618068376407c86" ON "employee_setting" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_c17e703a7008f6b9c2770a5cba" ON "employee" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_0c5508f4c86446f84d609e3b76" ON "equipment_sharing_policy" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_21bb7aec28dbb12ebc58a41d02" ON "equipment_sharing" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_7ed01d2a28f6cc9acb72c5fcf8" ON "equipment" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_c029854e57e273cb30445e6417" ON "estimate_email" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_e261b3b6ed4c6e79901fb3e1bc" ON "event_type" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_0edbfb90f0bc4c28eb57892900" ON "expense_category" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_6620af16ccd56e7e52b6ad914d" ON "expense" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_ca5fc2af0a26e454779d014a6a" ON "import-history" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_b1669a96371cbdb8fd8d4724d6" ON "import-record" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c795b7a18f1213b980bcc91ffe" ON "feature_organization" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_3c0aa9d1eabc26757fbddc2bb9" ON "feature" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_03dbd727034c431934185d1d6f" ON "goal_general_setting" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_84a5a399408725b9c8612767e0" ON "goal_kpi_template" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_dae34450bed722e897370e2aec" ON "goal_kpi" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_25e0f8060ed921994873391253" ON "goal_template" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_cc3487eb32dd8baa86a8043540" ON "goal_time_frame" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_265b5cbc3e414bb3bb2facbb22" ON "goal" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_2a8cd17a33093bb6afed97e9d3" ON "image_asset" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_263e874cebea17ad3f2ba39e11" ON "income" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_2a9f9f6fa9064b328e277063a1" ON "integration_entity_setting_tied" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5053bf22f9e0a5e9e8df7850da" ON "integration_entity_setting" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_3907c6f563fc45d824558d239d" ON "integration_map" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_02f667ad727ca0975d5022e695" ON "integration_setting" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b6654519fbad729cdb490069be" ON "integration_tenant" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_842e81def8eef9f71a97496ff1" ON "integration_type" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_90aec772805c7fd508d71bedfe" ON "integration" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_00a3c849694b6f8be7b193c888" ON "invite" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_599de8ec6ea69550c6d49c4ae1" ON "invoice_estimate_history" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_457cbab434fc9a031f03eb6211" ON "invoice_item" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_40ee7b28c0ea835534a93b54bf" ON "invoice" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_04b8ef5663b40baa58e1b65160" ON "key_result_template" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c5df67196c2aca0a7fb6ffd274" ON "key_result_update" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_30bf8575f0744aa3b68b611985" ON "key_result" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_745828269219870069b3b46a7f" ON "language" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_ebff440aec581d4893ad743c7e" ON "merchant" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_20aebc4219b9f9196f5ca2344d" ON "organization_award" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cdf46b38fd75cd7baebce81cc6" ON "organization_contact" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8cf81262c7cddfcf3fedcbc106" ON "organization_department" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bf9a2edebcda9ac2c59e4439cb" ON "organization_document" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a11abe644b2cb5810bb65c8f9" ON "organization_employment_type" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_94330f9121dd1e72fe31fdb3c5" ON "organization_language" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1bff92d7a3b4b1f1a0e62a5122" ON "organization_position" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fdd58e4f13a3f4a92c70bcdb30" ON "organization_project" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_16c34de330ae8d59d9b31cce14" ON "organization_project" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_05edb214d298384f9f918d6b5d" ON "organization_project" ("managerId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_489012234f53089d4b508f4aa1" ON "organization_project" ("defaultAssigneeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_21510dbb86b763f55a8bf4ec93" ON "organization_project_module" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_636a95bda1eaf9fab00849dec2" ON "organization_recurring_expense" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cbb3f1eb241abc47103df48f83" ON "organization_sprint" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_60683da6db3f64a0767d40b291" ON "organization_task_setting" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d109b8470a4cf2662bec0a672b" ON "organization_team_employee" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5deae148453dfaf555b24d151f" ON "organization_team_join_request" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_af48bbfa76f6261a5520e5e90f" ON "organization_team" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_6c41095093c47ac91434a1bdf9" ON "organization_vendor" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_3c5fdf6c34ed7a20fae6c9ae94" ON "organization" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_7f8ba01a73690cbabe6c6ab93c" ON "password_reset" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_523b77d9dcbace8377fbca05ae" ON "payment" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_c5075efc6dab483721af36616f" ON "pipeline_stage" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_8b0d255d8f0ec4ca22e36249a8" ON "pipeline" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_2dce278beac80aebe7e179d7c9" ON "product_category_translation" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_89d6d92ce60b7b6de00449b30d" ON "product_category" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e69de0d6c91d71407822a95bc9" ON "product_option_group" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fdca637f69b879c6e95525a01f" ON "product_option_group_translation" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_eed2b389448b96ec1118ca38ef" ON "product_option_translation" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_41bff03b05f43a4e22e54cb83e" ON "product_option" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_18a46a61494103f9db1c42285d" ON "product_variant_setting" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7c3776ae0d403baebc8a9387d8" ON "product_type_translation" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_577cfbbd0e9dedad955108df36" ON "product_type" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_3041f4d50857a4bc37dd72f233" ON "product_variant_price" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_0eb547a970dfecff424eb2098b" ON "product_variant" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_98c2019d4a108469e30b265972" ON "product" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_12de5ef2de583b2e92a1dfee3d" ON "product_translation" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_0ad88d687468141532bef9cc5e" ON "report_category" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_3619176cb8845c5c03803caf9d" ON "report_organization" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5a453f466165d928a495e158ac" ON "report" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f6c789158e91e7a6242174aaae" ON "request_approval_employee" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c02d6337074841598e6952fed" ON "request_approval_team" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_aac7b3092d5d02d80deb5808b3" ON "request_approval" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_8cdc64dbd7f2ed3f8850bd2592" ON "role_permission" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_6c388c8d50b4238ab077fdc800" ON "role" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_0d379f40301224bfa5043dc7cc" ON "skill" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_1ddd19850ad49f4e61ad727018" ON "tag" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_1255e02d6dddd4e09a5ddb10d4" ON "daily_plan" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_da2990e3e7d2047d950ab8edea" ON "task_estimation" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_2ff61d100d00793724c099b86c" ON "issue_type" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_93bb4c9fb014dda0d984e9060a" ON "task" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_024d5a6727f6f4804d8cecfe32" ON "task_linked_issues" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_f9fdc26bc564bf9f7963489f23" ON "task_priority" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d1689daf93e2cb6029a9ff96d2" ON "task_related_issue_type" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c364d9cb885e274666950b1afc" ON "task_size" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_259cb3e6d0d59edad2798b0ac3" ON "task_status" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_526e175838190ccc3c350df01a" ON "task_version" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_6e8dc5c9992499a05248237e58" ON "tenant_setting" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_10ede978ae7c1b67755932eac6" ON "tenant" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_21aa702abacf7dabe11da12818" ON "time_off_policy" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_a5c6d8b62974fb9e4161e09499" ON "time_off_request" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_83df5ca85dae51ff9341e47785" ON "activity" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_afad5ae421b31768c4232f7224" ON "screenshot" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_2cbd790171893d994992116f19" ON "time_log" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_b520b83e91a6d3c8ef33675efe" ON "time_slot" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_bb9f95f639ced2a5b71395169e" ON "time_slot_minute" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_43f3709ff2b8dcc90c1809b023" ON "timesheet" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_6f87e00eb9e37242f01e6e5566" ON "user_organization" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_e49cb4b6b256bd4a5edab1e4dd" ON "user" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_fa9bdc44b90c4f32e658938a2d" ON "warehouse_product" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_21bba7ad2249260cc9d0022af9" ON "warehouse_product_variant" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_66abaca4fc9c367203403310aa" ON "warehouse" ("archivedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_888ffe5a395d1cf7afb001dc3a" ON "changelog" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_55dbb0b04712921d3c5dd7664e" ON "organization_github_repository" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_290ccd540d1e1f450c408539a1" ON "organization_github_repository_issue" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_811cc78a6e4df2ae75d237e40e" ON "proposal" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b73b978dcd27856a83df0d23c" ON "employee_proposal_template" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_551be2742a129d5d8ff461e9fe" ON "job_search_occupation" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4b69eac7a9f1b9e93eebe3a850" ON "job_search_category" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0d66c27013f4c34b339738f210" ON "employee_upwork_job_search_criterion" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c271c2698e24de252f1fd148f0" ON "job_preset" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_84a641af24ce125f296142216b" ON "job_preset_upwork_job_search_criterion" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_407463aef81b89c8bc5943ac8a" ON "knowledge_base" ("archivedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_bd8360d2c539ae6b351129c86d" ON "knowledge_base_article" ("archivedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_eb418dd0f3234df01222bcf438" ON "knowledge_base_author" ("archivedAt") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c94775caea731394d690d67db1" ON "product_review" ("archivedAt") `);
		await queryRunner.query(
			`ALTER TABLE "organization_project" ADD CONSTRAINT "FK_05edb214d298384f9f918d6b5d2" FOREIGN KEY ("managerId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project" ADD CONSTRAINT "FK_489012234f53089d4b508f4aa12" FOREIGN KEY ("defaultAssigneeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "organization_project" DROP CONSTRAINT "FK_489012234f53089d4b508f4aa12"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP CONSTRAINT "FK_05edb214d298384f9f918d6b5d2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c94775caea731394d690d67db1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_eb418dd0f3234df01222bcf438"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bd8360d2c539ae6b351129c86d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_407463aef81b89c8bc5943ac8a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_84a641af24ce125f296142216b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c271c2698e24de252f1fd148f0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0d66c27013f4c34b339738f210"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4b69eac7a9f1b9e93eebe3a850"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_551be2742a129d5d8ff461e9fe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6b73b978dcd27856a83df0d23c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_811cc78a6e4df2ae75d237e40e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_290ccd540d1e1f450c408539a1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_55dbb0b04712921d3c5dd7664e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_888ffe5a395d1cf7afb001dc3a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_66abaca4fc9c367203403310aa"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_21bba7ad2249260cc9d0022af9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fa9bdc44b90c4f32e658938a2d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e49cb4b6b256bd4a5edab1e4dd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6f87e00eb9e37242f01e6e5566"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_43f3709ff2b8dcc90c1809b023"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bb9f95f639ced2a5b71395169e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b520b83e91a6d3c8ef33675efe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2cbd790171893d994992116f19"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_afad5ae421b31768c4232f7224"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_83df5ca85dae51ff9341e47785"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a5c6d8b62974fb9e4161e09499"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_21aa702abacf7dabe11da12818"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_10ede978ae7c1b67755932eac6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6e8dc5c9992499a05248237e58"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_526e175838190ccc3c350df01a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_259cb3e6d0d59edad2798b0ac3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c364d9cb885e274666950b1afc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d1689daf93e2cb6029a9ff96d2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f9fdc26bc564bf9f7963489f23"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_024d5a6727f6f4804d8cecfe32"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_93bb4c9fb014dda0d984e9060a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2ff61d100d00793724c099b86c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_da2990e3e7d2047d950ab8edea"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1255e02d6dddd4e09a5ddb10d4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1ddd19850ad49f4e61ad727018"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0d379f40301224bfa5043dc7cc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6c388c8d50b4238ab077fdc800"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8cdc64dbd7f2ed3f8850bd2592"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_aac7b3092d5d02d80deb5808b3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1c02d6337074841598e6952fed"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f6c789158e91e7a6242174aaae"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5a453f466165d928a495e158ac"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3619176cb8845c5c03803caf9d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0ad88d687468141532bef9cc5e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_12de5ef2de583b2e92a1dfee3d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_98c2019d4a108469e30b265972"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0eb547a970dfecff424eb2098b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3041f4d50857a4bc37dd72f233"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_577cfbbd0e9dedad955108df36"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7c3776ae0d403baebc8a9387d8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_18a46a61494103f9db1c42285d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_41bff03b05f43a4e22e54cb83e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_eed2b389448b96ec1118ca38ef"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fdca637f69b879c6e95525a01f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e69de0d6c91d71407822a95bc9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_89d6d92ce60b7b6de00449b30d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2dce278beac80aebe7e179d7c9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8b0d255d8f0ec4ca22e36249a8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c5075efc6dab483721af36616f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_523b77d9dcbace8377fbca05ae"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7f8ba01a73690cbabe6c6ab93c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3c5fdf6c34ed7a20fae6c9ae94"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6c41095093c47ac91434a1bdf9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_af48bbfa76f6261a5520e5e90f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5deae148453dfaf555b24d151f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d109b8470a4cf2662bec0a672b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_60683da6db3f64a0767d40b291"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cbb3f1eb241abc47103df48f83"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_636a95bda1eaf9fab00849dec2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_21510dbb86b763f55a8bf4ec93"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_489012234f53089d4b508f4aa1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_05edb214d298384f9f918d6b5d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_16c34de330ae8d59d9b31cce14"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fdd58e4f13a3f4a92c70bcdb30"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1bff92d7a3b4b1f1a0e62a5122"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_94330f9121dd1e72fe31fdb3c5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8a11abe644b2cb5810bb65c8f9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bf9a2edebcda9ac2c59e4439cb"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8cf81262c7cddfcf3fedcbc106"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cdf46b38fd75cd7baebce81cc6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_20aebc4219b9f9196f5ca2344d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ebff440aec581d4893ad743c7e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_745828269219870069b3b46a7f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_30bf8575f0744aa3b68b611985"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c5df67196c2aca0a7fb6ffd274"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_04b8ef5663b40baa58e1b65160"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_40ee7b28c0ea835534a93b54bf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_457cbab434fc9a031f03eb6211"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_599de8ec6ea69550c6d49c4ae1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_00a3c849694b6f8be7b193c888"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_90aec772805c7fd508d71bedfe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_842e81def8eef9f71a97496ff1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b6654519fbad729cdb490069be"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_02f667ad727ca0975d5022e695"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3907c6f563fc45d824558d239d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5053bf22f9e0a5e9e8df7850da"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2a9f9f6fa9064b328e277063a1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_263e874cebea17ad3f2ba39e11"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2a8cd17a33093bb6afed97e9d3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_265b5cbc3e414bb3bb2facbb22"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cc3487eb32dd8baa86a8043540"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_25e0f8060ed921994873391253"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_dae34450bed722e897370e2aec"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_84a5a399408725b9c8612767e0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_03dbd727034c431934185d1d6f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3c0aa9d1eabc26757fbddc2bb9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c795b7a18f1213b980bcc91ffe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b1669a96371cbdb8fd8d4724d6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ca5fc2af0a26e454779d014a6a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6620af16ccd56e7e52b6ad914d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0edbfb90f0bc4c28eb57892900"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e261b3b6ed4c6e79901fb3e1bc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c029854e57e273cb30445e6417"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7ed01d2a28f6cc9acb72c5fcf8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_21bb7aec28dbb12ebc58a41d02"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0c5508f4c86446f84d609e3b76"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c17e703a7008f6b9c2770a5cba"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a8e048dfb4d618068376407c86"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_185b880550575c61d4212896e2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_08e391262cb3d4fbe9db97ecf8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9dff154a1be222c66c179ad14b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cee87c9b8743f0e81db8152f68"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e69d60f1adcded4445095c4787"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ce96229ae8d1d1af61348730da"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_35ac91a92c521b68277e780e6e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_753f4b022ec98a0c8f38b370c0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_284658fe519bca6048fd73ff72"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_36106478339961c8a17674a031"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e99bb270f0fa89ea715a457d29"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_711fd0159178a0102abc4db336"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_67a4423093e3c311cb76275659"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ac765cfc390ec77d765dd48b61"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5cb080756923318f19f1d2eabe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_df0a9a4b6ae0e3cab9c4f35436"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f651e72ab42727f28c29441f1b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fa411cb89c9c6848d192d7f2e6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_54b281d06e1a4e7e6ff640dab4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_09f72a1a309aae91e0cd83949a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_89ff7e0a8c37fdf7770b753776"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bb09aa3130d0e54007a98523c5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_745780f5553e56a3ca19bccf86"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4985a92870282574f6fec8dd98"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_75bd5526e43c8801085225ffa9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c323aa830e10a871854d0a0408"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2ada776a231239b8e99f78bf64"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_829e02292a572f25476c4e426c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e0c6443e0d2d5630067bc10ccf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5d74a3f25e6acfb6caec05ec65"`);
		await queryRunner.query(`ALTER TABLE "product_review" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_author" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "knowledge_base_article" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "knowledge_base" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "job_preset_upwork_job_search_criterion" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "job_preset" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "employee_upwork_job_search_criterion" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "job_search_category" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "job_search_occupation" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "employee_proposal_template" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "proposal" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_github_repository_issue" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_github_repository" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "changelog" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "warehouse" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "user_organization" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "timesheet" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "time_slot" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "time_log" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "screenshot" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "activity" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "time_off_request" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "time_off_policy" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "tenant" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "tenant_setting" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "task_version" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "task_status" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "task_size" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "task_related_issue_type" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "task_priority" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "task_linked_issues" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "issue_type" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "task_estimation" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "daily_plan" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "tag" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "skill" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "role_permission" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "request_approval" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "request_approval_team" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "request_approval_employee" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "report" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "report_organization" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "report_category" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "product_translation" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "product_variant_price" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "product_type" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "product_type_translation" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "product_variant_setting" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "product_option" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "product_option_translation" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "product_option_group_translation" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "product_option_group" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "product_category" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "product_category_translation" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "pipeline" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "pipeline_stage" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "password_reset" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_vendor" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_team" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_team_join_request" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_team_employee" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_task_setting" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_sprint" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_recurring_expense" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project_module" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "defaultAssigneeId"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "managerId"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "closeTasksIn"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "archiveTasksIn"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "icon"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "status"`);
		await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_position" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_language" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_employment_type" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_document" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_department" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_contact" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_award" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "merchant" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "language" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "key_result" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "key_result_update" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "key_result_template" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "invoice_item" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "invoice_estimate_history" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "invite" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "integration" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "integration_type" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "integration_tenant" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "integration_setting" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "integration_map" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "integration_entity_setting" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "integration_entity_setting_tied" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "income" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "image_asset" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "goal" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "goal_time_frame" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "goal_template" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "goal_kpi" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "goal_kpi_template" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "goal_general_setting" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "feature" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "feature_organization" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "import-record" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "import-history" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "expense" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "expense_category" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "event_type" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "estimate_email" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "equipment" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "equipment_sharing_policy" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "employee" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "employee_recurring_expense" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "employee_phone" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "employee_level" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "employee_award" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "employee_appointment" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "email_template" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "email_reset" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "email_sent" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "deal" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "custom_smtp" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "currency" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "country" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "contact" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "candidate_technology" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "candidate_source" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "candidate_skill" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "candidate_personal_quality" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "candidate_interviewer" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "candidate_interview" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "candidate_feedback" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "candidate_experience" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "candidate_education" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "candidate_document" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "candidate_criterion_rating" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "social_account" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "availability_slot" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "approval_policy" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "appointment_employee" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "accounting_template" DROP COLUMN "archivedAt"`);
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
