import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import { yellow } from 'chalk';

export class MysqlTablesMigration1705138670108 implements MigrationInterface {
	name = 'MysqlTablesMigration1705138670108';

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
		await queryRunner.query(
			`CREATE TABLE \`accounting_template\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`languageCode\` varchar(255) NOT NULL, \`mjml\` text NULL, \`hbs\` longtext NOT NULL, \`templateType\` varchar(255) NOT NULL, INDEX \`IDX_5cf7c007fc9c83bee748f08806\` (\`isActive\`), INDEX \`IDX_7ac2c1c487dd77fe38c2d571ea\` (\`isArchived\`), INDEX \`IDX_2ca6a49062a4ed884e413bf572\` (\`tenantId\`), INDEX \`IDX_e66511b175393255c6c4e7b007\` (\`organizationId\`), INDEX \`IDX_968c1c9a131a61a3720b3a72f6\` (\`name\`), INDEX \`IDX_a841eabc6b656c965d8846223e\` (\`languageCode\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`appointment_employee\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`appointmentId\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NOT NULL, \`employeeAppointmentId\` varchar(255) NULL, INDEX \`IDX_379af16b0aeed6a4d8f15c53bc\` (\`isActive\`), INDEX \`IDX_2a6f8c4b8da6f85e2903daf5c3\` (\`isArchived\`), INDEX \`IDX_2c0494466d5a7e1165cea3dca9\` (\`tenantId\`), INDEX \`IDX_3c3a62226896345c4716bfe1d9\` (\`organizationId\`), INDEX \`IDX_0ddc50b7521b9a905d9ca8c8ba\` (\`employeeId\`), INDEX \`IDX_e9ca170a0fae05e44a9bd137d8\` (\`employeeAppointmentId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`approval_policy\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`approvalType\` varchar(255) NULL, INDEX \`IDX_338364927c68961167606e989c\` (\`isActive\`), INDEX \`IDX_f50ce5a39d610cfcd9da9652b1\` (\`isArchived\`), INDEX \`IDX_1462391059ebe137645098d727\` (\`tenantId\`), INDEX \`IDX_dfe3b357df3ce136917b1f0984\` (\`organizationId\`), INDEX \`IDX_45f32a5a12d42fba17fe62a279\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`availability_slot\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`startTime\` datetime NOT NULL, \`endTime\` datetime NOT NULL, \`allDay\` tinyint NOT NULL, \`type\` text NULL, \`employeeId\` varchar(255) NULL, INDEX \`IDX_3e20b617c7d7a87b8bf53ddcbe\` (\`isActive\`), INDEX \`IDX_3aabb2cdf5b6e0df87cb94bdca\` (\`isArchived\`), INDEX \`IDX_f008a481cb4eed547704bb9d83\` (\`tenantId\`), INDEX \`IDX_d544bd3a63634a4438509ac958\` (\`organizationId\`), INDEX \`IDX_46ed3c2287423f5dc089100fee\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate_criterion_rating\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`rating\` int NOT NULL, \`technologyId\` varchar(255) NULL, \`personalQualityId\` varchar(255) NULL, \`feedbackId\` varchar(255) NULL, INDEX \`IDX_0a417dafb1dd14eb92a69fa641\` (\`isActive\`), INDEX \`IDX_fcab96cef60fd8bccac610ccef\` (\`isArchived\`), INDEX \`IDX_9d5bd131452ef689df2b46551b\` (\`tenantId\`), INDEX \`IDX_b106406e94bb7317493efc2c98\` (\`organizationId\`), INDEX \`IDX_d1d16bc87d3afaf387f34cdceb\` (\`technologyId\`), INDEX \`IDX_ba4c376b2069aa82745d4e9682\` (\`personalQualityId\`), INDEX \`IDX_159f821dd214792f1d2ad9cff7\` (\`feedbackId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate_document\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`documentUrl\` varchar(255) NULL, \`candidateId\` varchar(255) NULL, INDEX \`IDX_bf8070715e42b3afe9730e7b30\` (\`isActive\`), INDEX \`IDX_3ed4bac12d0ca32eada4ea5a49\` (\`isArchived\`), INDEX \`IDX_4d9b7ab09f9f9517d488b5fed1\` (\`tenantId\`), INDEX \`IDX_d108a827199fda86a9ec216989\` (\`organizationId\`), INDEX \`IDX_3f9053719c9d11ebdea03e5a2d\` (\`candidateId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate_education\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`schoolName\` varchar(255) NOT NULL, \`degree\` varchar(255) NOT NULL, \`field\` varchar(255) NOT NULL, \`completionDate\` datetime NOT NULL, \`notes\` varchar(255) NULL, \`candidateId\` varchar(255) NULL, INDEX \`IDX_336eb14606016757d2302efa4d\` (\`isActive\`), INDEX \`IDX_b443c78c3796f2e9aab05a2bb9\` (\`isArchived\`), INDEX \`IDX_00cdd9ed7571be8e2c8d09e7cd\` (\`tenantId\`), INDEX \`IDX_f660af89b2c69fea2334508cbb\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate_experience\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`occupation\` varchar(255) NOT NULL, \`duration\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`candidateId\` varchar(255) NULL, INDEX \`IDX_dafa68d060cf401d5f62a57ad4\` (\`isActive\`), INDEX \`IDX_c24bce6dd33e56ef8e8dacef1a\` (\`isArchived\`), INDEX \`IDX_8dcf5fc8bc7f77a80b0fc648bf\` (\`tenantId\`), INDEX \`IDX_a50eb955f940ca93e044d175c6\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate_feedback\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`description\` varchar(255) NULL, \`rating\` decimal NULL, \`status\` enum ('APPLIED', 'REJECTED', 'HIRED') NULL, \`candidateId\` varchar(255) NULL, \`interviewId\` varchar(255) NULL, \`interviewerId\` varchar(255) NULL, INDEX \`IDX_c660aef2ca5aff9dbf45a9a4bb\` (\`isActive\`), INDEX \`IDX_05ed49a5ebdd5ec533f913b620\` (\`isArchived\`), INDEX \`IDX_6cb21fa0f65ff69679966c836f\` (\`tenantId\`), INDEX \`IDX_3a6928f8501fce33820721a8fe\` (\`organizationId\`), INDEX \`IDX_98c008fd8cf597e83dcdccfd16\` (\`candidateId\`), INDEX \`IDX_0862c274d336126b951bfe009a\` (\`interviewId\`), UNIQUE INDEX \`REL_44f3d80c3293e1de038c87f115\` (\`interviewerId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate_interview\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`title\` varchar(255) NOT NULL, \`startTime\` datetime NULL, \`endTime\` datetime NULL, \`location\` varchar(255) NULL, \`note\` varchar(255) NULL, \`rating\` decimal NULL, \`candidateId\` varchar(255) NULL, INDEX \`IDX_b9191cf49f8cd1f192cb74233c\` (\`isActive\`), INDEX \`IDX_7b49ce2928b327213f2de66b95\` (\`isArchived\`), INDEX \`IDX_59b765e6d13d83dba4852a43eb\` (\`tenantId\`), INDEX \`IDX_03be41e88b1fecfe4e24d6b04b\` (\`organizationId\`), INDEX \`IDX_91996439c4baafee8395d3df15\` (\`candidateId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate_interviewer\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`interviewId\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NULL, INDEX \`IDX_b9132118c3a98c4c48e417c0c5\` (\`isActive\`), INDEX \`IDX_2043abff09f084fb8690009fb8\` (\`isArchived\`), INDEX \`IDX_f0ca69c78eea92c95d9044764a\` (\`tenantId\`), INDEX \`IDX_5f1e315db848990dfffa72817c\` (\`organizationId\`), INDEX \`IDX_ecb65075e94b47bbab11cfa5a1\` (\`interviewId\`), INDEX \`IDX_9e7b20eb3dfa082b83b198fdad\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate_personal_quality\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`rating\` decimal NULL, \`interviewId\` varchar(255) NULL, INDEX \`IDX_afe01503d4337c9623c06f22df\` (\`isActive\`), INDEX \`IDX_ff6776d92db4ef71edbfba9903\` (\`isArchived\`), INDEX \`IDX_045de7c208adcd0c68c0a65174\` (\`tenantId\`), INDEX \`IDX_d321f4547ed467d07cce1e7d9a\` (\`organizationId\`), INDEX \`IDX_a0d171f45bdbcf2b990c0c37c3\` (\`interviewId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate_skill\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`candidateId\` varchar(255) NULL, INDEX \`IDX_6907163d0bb8e9f0440b9bf2a7\` (\`isActive\`), INDEX \`IDX_a38fe0c3f2ff0a4e475f2a1347\` (\`isArchived\`), INDEX \`IDX_8a07f780c6fce2b82830ab0687\` (\`tenantId\`), INDEX \`IDX_d7986743e7f11720349a6c9557\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate_source\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, INDEX \`IDX_2be9182096747fb18cb8afb1f0\` (\`isActive\`), INDEX \`IDX_509101ab1a46a5934ee278d447\` (\`isArchived\`), INDEX \`IDX_b2a1ba27a76dd819cd8294cce3\` (\`tenantId\`), INDEX \`IDX_e92027b5280828cadd7cd6ea71\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate_technology\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`rating\` decimal NULL, \`interviewId\` varchar(255) NULL, INDEX \`IDX_199ca43300fa4e64239656a677\` (\`isActive\`), INDEX \`IDX_97aa0328b72e1bf919e61bccdc\` (\`isArchived\`), INDEX \`IDX_a6fecb615b07987b480defac64\` (\`tenantId\`), INDEX \`IDX_9d46b8c5382acd4d4514bc5c62\` (\`organizationId\`), INDEX \`IDX_063663c7e61e45d172d1b83265\` (\`interviewId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`rating\` decimal NULL, \`valueDate\` datetime NULL, \`appliedDate\` datetime NULL, \`hiredDate\` datetime NULL, \`status\` varchar(255) NULL DEFAULT 'APPLIED', \`rejectDate\` datetime NULL, \`candidateLevel\` varchar(500) NULL, \`reWeeklyLimit\` int NULL, \`billRateCurrency\` varchar(255) NULL, \`billRateValue\` int NULL, \`minimumBillingRate\` int NULL, \`payPeriod\` varchar(255) NULL, \`cvUrl\` varchar(255) NULL, \`contactId\` varchar(255) NULL, \`organizationPositionId\` varchar(255) NULL, \`sourceId\` varchar(255) NULL, \`userId\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NULL, INDEX \`IDX_2b8091376a529383e23ba3356a\` (\`isActive\`), INDEX \`IDX_af835b66fa10279103bd89e225\` (\`isArchived\`), INDEX \`IDX_77ac426e04553ff1654421bce4\` (\`tenantId\`), INDEX \`IDX_16fb27ffd1a99c6506c92ad57a\` (\`organizationId\`), INDEX \`IDX_b674793a804b7d69d74c8f6c5b\` (\`contactId\`), INDEX \`IDX_1e3e8228e7df634fa4cec6322c\` (\`organizationPositionId\`), INDEX \`IDX_4ea108fd8b089237964d5f98fb\` (\`sourceId\`), INDEX \`IDX_3930aa71e0fa24f09201811b1b\` (\`userId\`), INDEX \`IDX_8b900e8a39f76125e610ab30c0\` (\`employeeId\`), UNIQUE INDEX \`REL_b674793a804b7d69d74c8f6c5b\` (\`contactId\`), UNIQUE INDEX \`REL_4ea108fd8b089237964d5f98fb\` (\`sourceId\`), UNIQUE INDEX \`REL_3930aa71e0fa24f09201811b1b\` (\`userId\`), UNIQUE INDEX \`REL_8b900e8a39f76125e610ab30c0\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`contact\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NULL, \`firstName\` varchar(255) NULL, \`lastName\` varchar(255) NULL, \`country\` varchar(255) NULL, \`city\` varchar(255) NULL, \`address\` varchar(255) NULL, \`address2\` varchar(255) NULL, \`postcode\` varchar(255) NULL, \`latitude\` decimal NULL, \`longitude\` decimal NULL, \`regionCode\` varchar(255) NULL, \`fax\` varchar(255) NULL, \`fiscalInformation\` varchar(255) NULL, \`website\` varchar(255) NULL, INDEX \`IDX_05831d37eabeb6150f99c69784\` (\`isActive\`), INDEX \`IDX_4164bd34bdcce8754641f0e567\` (\`isArchived\`), INDEX \`IDX_60468af1ce34043a900809c84f\` (\`tenantId\`), INDEX \`IDX_7719d73cd16a9f57ecc6ac24b3\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`country\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`isoCode\` varchar(255) NOT NULL, \`country\` varchar(255) NOT NULL, INDEX \`IDX_97ebcd8db30a408b5f907d6ff4\` (\`isActive\`), INDEX \`IDX_6cd9b7ea6818e862217035436c\` (\`isArchived\`), INDEX \`IDX_6eba1a52ee121d100c8a0a6510\` (\`isoCode\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`currency\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`isoCode\` varchar(255) NOT NULL, \`currency\` varchar(255) NOT NULL, INDEX \`IDX_03cc024ddc2f196dca7fead7cb\` (\`isActive\`), INDEX \`IDX_8203f1410475748bbbc6d3029d\` (\`isArchived\`), INDEX \`IDX_0b0fbda74f6c82c943e706a3cc\` (\`isoCode\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`custom_smtp\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`fromAddress\` varchar(255) NULL, \`host\` varchar(255) NOT NULL, \`port\` int NOT NULL, \`secure\` tinyint NOT NULL, \`username\` varchar(255) NOT NULL, \`password\` varchar(255) NOT NULL, \`isValidate\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_e2c7d28bb07adc915d74437c7b\` (\`isActive\`), INDEX \`IDX_f10372f9d038d0954d5b20635a\` (\`isArchived\`), INDEX \`IDX_2aa3fc8daa25beec4788d2be26\` (\`tenantId\`), INDEX \`IDX_15a1306132d66c63ef31f7288c\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`deal\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`title\` varchar(255) NOT NULL, \`probability\` int NOT NULL, \`createdByUserId\` varchar(255) NOT NULL, \`stageId\` varchar(255) NOT NULL, \`clientId\` varchar(255) NULL, INDEX \`IDX_0d8c964237e5061627de82df80\` (\`isActive\`), INDEX \`IDX_443c561d45f6c57f3790a759ba\` (\`isArchived\`), INDEX \`IDX_46a3c00bfc3e36b4412d8bcdb0\` (\`tenantId\`), INDEX \`IDX_38fb85abdf9995efcf217f5955\` (\`organizationId\`), INDEX \`IDX_4b1ff44e6bae5065429dbab554\` (\`createdByUserId\`), INDEX \`IDX_9211f5b62988df6e95522be7da\` (\`stageId\`), UNIQUE INDEX \`REL_1ae3abc0ae1dcf6c13f49b62b5\` (\`clientId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`email_sent\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NULL, \`content\` text NULL, \`email\` varchar(255) NOT NULL, \`userId\` varchar(255) NULL, \`emailTemplateId\` varchar(255) NOT NULL, \`status\` enum ('SENT', 'FAILED') NULL, INDEX \`IDX_d825bc6da1c52a3900a9373260\` (\`isActive\`), INDEX \`IDX_9a69f7077e0333d2c848895a1b\` (\`isArchived\`), INDEX \`IDX_0af511c44de7a16beb45cc3785\` (\`tenantId\`), INDEX \`IDX_525f4873c6edc3d94559f88900\` (\`organizationId\`), INDEX \`IDX_953df0eb0df3035baf140399f6\` (\`name\`), INDEX \`IDX_a954fda57cca81dc48446e73b8\` (\`email\`), INDEX \`IDX_1261c457b3035b77719556995b\` (\`userId\`), INDEX \`IDX_9033faf41b23c61ba201c48796\` (\`emailTemplateId\`), INDEX \`IDX_5956ce758c01ebf8a539e8d4f0\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`email_reset\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`email\` varchar(255) NOT NULL, \`oldEmail\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, \`token\` varchar(255) NULL, \`expiredAt\` datetime NULL, \`userId\` varchar(255) NULL, INDEX \`IDX_e3321e3575289b7ee1e8eb1042\` (\`isActive\`), INDEX \`IDX_13247a755d17e7905d5bb4cfda\` (\`isArchived\`), INDEX \`IDX_93799dfaeff51de06f1e02ac41\` (\`tenantId\`), INDEX \`IDX_03d16a2fd43d7c601743440212\` (\`email\`), INDEX \`IDX_4be518a169bbcbfe92025ac574\` (\`oldEmail\`), INDEX \`IDX_9e80c9ec749dfda6dbe2cd9704\` (\`code\`), INDEX \`IDX_4ac734f2a1a3c055dca04fba99\` (\`token\`), INDEX \`IDX_e37af4ab2ba0bf268bfd982634\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`email_template\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`languageCode\` varchar(255) NOT NULL, \`mjml\` text NULL, \`hbs\` longtext NOT NULL, INDEX \`IDX_e4932e0a726b9b07d81d8b6905\` (\`isActive\`), INDEX \`IDX_29d60114e1968c0cd68a19e3c5\` (\`isArchived\`), INDEX \`IDX_753e005a45556b5909e11937aa\` (\`tenantId\`), INDEX \`IDX_c160fe6234675fac031aa3e7c5\` (\`organizationId\`), INDEX \`IDX_274708db64fcce5448f2c4541c\` (\`name\`), INDEX \`IDX_7e688e6613930ba721b841db43\` (\`languageCode\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`employee_appointment\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`employeeId\` varchar(255) NULL, \`agenda\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`location\` varchar(255) NULL, \`startDateTime\` datetime NOT NULL, \`endDateTime\` datetime NOT NULL, \`bufferTimeStart\` tinyint NULL, \`bufferTimeEnd\` tinyint NULL, \`bufferTimeInMins\` int NULL, \`breakTimeInMins\` int NULL, \`breakStartTime\` datetime NULL, \`emails\` varchar(255) NULL, \`status\` varchar(255) NULL, INDEX \`IDX_d0219ada2359ede9e7b0d511ba\` (\`isActive\`), INDEX \`IDX_64c83df9d37d9ada96edb66557\` (\`isArchived\`), INDEX \`IDX_a35637bb659c59e18adb4f38f8\` (\`tenantId\`), INDEX \`IDX_86cf36c137712e779dd7e2301e\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`employee_award\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`year\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NOT NULL, INDEX \`IDX_c07390f325c847be7df93d0d17\` (\`isActive\`), INDEX \`IDX_8fb47e8bfd26340ddaeabd24e5\` (\`isArchived\`), INDEX \`IDX_91e0f7efcd17d20b5029fb1342\` (\`tenantId\`), INDEX \`IDX_caf8363b0ed7d5f24ae866ba3b\` (\`organizationId\`), INDEX \`IDX_6912685bbb0e303eab392978d9\` (\`name\`), INDEX \`IDX_0c5266f3f488add404f92d56ec\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`employee_upwork_job_search_criterion\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`jobPresetId\` varchar(255) NULL, \`employeeId\` varchar(255) NOT NULL, \`occupationId\` varchar(255) NULL, \`categoryId\` varchar(255) NULL, \`keyword\` varchar(255) NULL, \`jobType\` text NULL, INDEX \`IDX_6bae61744663a416e73903d9af\` (\`isActive\`), INDEX \`IDX_0e130a25bb4abe1b27c8a0adf4\` (\`isArchived\`), INDEX \`IDX_afe6c40d3d9951388fa05f83f2\` (\`tenantId\`), INDEX \`IDX_630337302efe97cc93deeb2151\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`job_preset_upwork_job_search_criterion\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`jobPresetId\` varchar(255) NOT NULL, \`occupationId\` varchar(255) NULL, \`categoryId\` varchar(255) NULL, \`keyword\` varchar(255) NULL, \`jobType\` text NULL, INDEX \`IDX_af850e1fa48af82d66e9bf81c7\` (\`isActive\`), INDEX \`IDX_4070b6f3480e9c4b2dcf3f7b56\` (\`isArchived\`), INDEX \`IDX_2323220b4decfd2f4d8307fd78\` (\`tenantId\`), INDEX \`IDX_d5ca48cfacfb516543d6507ca4\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`job_preset\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, INDEX \`IDX_46226c3185e3ca3d7033831d7a\` (\`isActive\`), INDEX \`IDX_e210f70c3904cf84ab5113be8f\` (\`isArchived\`), INDEX \`IDX_7e53ea80aca15da11a8a5ec038\` (\`tenantId\`), INDEX \`IDX_a4b038417e3221c0791dd8c771\` (\`organizationId\`), INDEX \`IDX_f2c1b6770dd2a3abfa35f49411\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`job_search_category\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`jobSourceCategoryId\` varchar(255) NULL, \`jobSource\` enum ('upwork', 'web', 'linkedin') NOT NULL DEFAULT 'upwork', INDEX \`IDX_36333846c37e5f8812a5c9f7ff\` (\`isActive\`), INDEX \`IDX_015231c6e28cfb2b789ca4b76f\` (\`isArchived\`), INDEX \`IDX_35e120f2b6e5188391cf068d3b\` (\`tenantId\`), INDEX \`IDX_86381fb6d28978b101b3aec8ca\` (\`organizationId\`), INDEX \`IDX_3b335bbcbf7d5e00853acaa165\` (\`name\`), INDEX \`IDX_d0a798419c775b9157bf0269f4\` (\`jobSourceCategoryId\`), INDEX \`IDX_6ee5218c869b57197e4a209bed\` (\`jobSource\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`job_search_occupation\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`jobSourceOccupationId\` varchar(255) NULL, \`jobSource\` enum ('upwork', 'web', 'linkedin') NOT NULL DEFAULT 'upwork', INDEX \`IDX_4b8450a24233df8b47ca472923\` (\`isActive\`), INDEX \`IDX_e4bc75a1cbb07d117a0acfcdba\` (\`isArchived\`), INDEX \`IDX_44e22d88b47daf2095491b7cac\` (\`tenantId\`), INDEX \`IDX_1a62a99e1016e4a2b461e886ec\` (\`organizationId\`), INDEX \`IDX_9f1288205ae91f91cf356cac2f\` (\`name\`), INDEX \`IDX_cb64573b18dd7b23f591f15502\` (\`jobSourceOccupationId\`), INDEX \`IDX_c8723c90a6f007f8d7e882a04f\` (\`jobSource\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`employee_level\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`level\` varchar(255) NOT NULL, INDEX \`IDX_90bd442869709bae9d1b18e489\` (\`isActive\`), INDEX \`IDX_88a58d149404145ed7b3385387\` (\`isArchived\`), INDEX \`IDX_d3fc52d497bc44d6f493dbedc3\` (\`tenantId\`), INDEX \`IDX_c4668533292bf4526e61aedf74\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`employee_phone\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`type\` varchar(255) NULL, \`phoneNumber\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NOT NULL, INDEX \`IDX_587d11ffbd87adb6dff367f3cd\` (\`isActive\`), INDEX \`IDX_aa98ea786d490db300d3dbbdb6\` (\`isArchived\`), INDEX \`IDX_d543336994b1f764c449e0b1d3\` (\`tenantId\`), INDEX \`IDX_0f9cefa604913e1ab322591546\` (\`organizationId\`), INDEX \`IDX_ba7b2ef5a9cd165a1e4e2ad0ef\` (\`phoneNumber\`), INDEX \`IDX_329ebd01a757d1a0c3c4d628e2\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`employee_proposal_template\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`content\` text NULL, \`isDefault\` tinyint NOT NULL DEFAULT 0, \`employeeId\` varchar(255) NOT NULL, INDEX \`IDX_2bb17670e2bea3980ff960bbcf\` (\`isActive\`), INDEX \`IDX_e396663e1a31114eac39087829\` (\`isArchived\`), INDEX \`IDX_f577c9bc6183c1d1eae1e154bb\` (\`tenantId\`), INDEX \`IDX_ee780fbd8f91de31c004929eec\` (\`organizationId\`), INDEX \`IDX_dc2ff85f7de16dea6453a833dd\` (\`name\`), FULLTEXT INDEX \`IDX_0111963c9cb4dd14565c0d9c84\` (\`content\`), INDEX \`IDX_a13f3564eae9db44ddc4308afc\` (\`isDefault\`), INDEX \`IDX_2be728a7f8b118712a4200990d\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`employee_recurring_expense\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`startDay\` int NOT NULL, \`startMonth\` int NOT NULL, \`startYear\` int NOT NULL, \`startDate\` datetime NOT NULL, \`endDay\` int NULL, \`endMonth\` int NULL, \`endYear\` int NULL, \`endDate\` datetime NULL, \`categoryName\` varchar(255) NOT NULL, \`value\` decimal NOT NULL, \`currency\` varchar(255) NOT NULL, \`parentRecurringExpenseId\` varchar(255) NULL, \`employeeId\` varchar(255) NULL, INDEX \`IDX_25f8915182128f377d84b60d26\` (\`isActive\`), INDEX \`IDX_3980b0fe1e757b092ea5323656\` (\`isArchived\`), INDEX \`IDX_5fde7be40b3c03bc0fdac0c2f6\` (\`tenantId\`), INDEX \`IDX_3ee5147bb1fde625fa33c0e956\` (\`organizationId\`), INDEX \`IDX_a4b5a2ea2afecf1ee254f1a704\` (\`categoryName\`), INDEX \`IDX_739f8cdce21cc72d400559ce00\` (\`currency\`), INDEX \`IDX_6e570174fda71e97616e9d2eea\` (\`parentRecurringExpenseId\`), INDEX \`IDX_0ac8526c48a3daa267c86225fb\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`employee_setting\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`month\` int NOT NULL, \`year\` int NOT NULL, \`settingType\` varchar(255) NOT NULL, \`value\` int NOT NULL, \`currency\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NOT NULL, INDEX \`IDX_48fae30026b4e166a3445fee6d\` (\`isActive\`), INDEX \`IDX_01237d04f882cf1ea794678e8d\` (\`isArchived\`), INDEX \`IDX_9516a627a131626d2a5738a05a\` (\`tenantId\`), INDEX \`IDX_56e96cd218a185ed59b5a8e786\` (\`organizationId\`), INDEX \`IDX_9537fae454ebebc98ee5adb3a2\` (\`settingType\`), INDEX \`IDX_710c71526edb89b2a7033abcdf\` (\`currency\`), INDEX \`IDX_95ea18af6ef8123503d332240c\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`employee\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`valueDate\` datetime NULL, \`short_description\` varchar(200) NULL, \`description\` varchar(255) NULL, \`startedWorkOn\` datetime NULL, \`endWork\` datetime NULL, \`payPeriod\` varchar(255) NULL, \`billRateValue\` int NULL, \`minimumBillingRate\` int NULL, \`billRateCurrency\` varchar(255) NULL, \`reWeeklyLimit\` int NULL, \`offerDate\` datetime NULL, \`acceptDate\` datetime NULL, \`rejectDate\` datetime NULL, \`employeeLevel\` varchar(500) NULL, \`anonymousBonus\` tinyint NULL, \`averageIncome\` decimal NULL, \`averageBonus\` decimal NULL, \`totalWorkHours\` decimal NULL DEFAULT '0', \`averageExpenses\` decimal NULL, \`show_anonymous_bonus\` tinyint NULL, \`show_average_bonus\` tinyint NULL, \`show_average_expenses\` tinyint NULL, \`show_average_income\` tinyint NULL, \`show_billrate\` tinyint NULL, \`show_payperiod\` tinyint NULL, \`show_start_work_on\` tinyint NULL, \`isJobSearchActive\` tinyint NULL, \`linkedInUrl\` varchar(255) NULL, \`facebookUrl\` varchar(255) NULL, \`instagramUrl\` varchar(255) NULL, \`twitterUrl\` varchar(255) NULL, \`githubUrl\` varchar(255) NULL, \`gitlabUrl\` varchar(255) NULL, \`upworkUrl\` varchar(255) NULL, \`stackoverflowUrl\` varchar(255) NULL, \`isVerified\` tinyint NULL, \`isVetted\` tinyint NULL, \`totalJobs\` decimal NULL, \`jobSuccess\` decimal NULL, \`profile_link\` varchar(255) NULL, \`isTrackingEnabled\` tinyint NULL DEFAULT 0, \`isOnline\` tinyint NULL DEFAULT 0, \`isAway\` tinyint NULL DEFAULT 0, \`isTrackingTime\` tinyint NULL DEFAULT 0, \`allowScreenshotCapture\` tinyint NOT NULL DEFAULT 1, \`upworkId\` varchar(255) NULL, \`linkedInId\` varchar(255) NULL, \`userId\` varchar(255) NOT NULL, \`contactId\` varchar(255) NULL, \`organizationPositionId\` varchar(255) NULL, INDEX \`IDX_510cb87f5da169e57e694d1a5c\` (\`isActive\`), INDEX \`IDX_175b7be641928a31521224daa8\` (\`isArchived\`), INDEX \`IDX_4b3303a6b7eb92d237a4379734\` (\`tenantId\`), INDEX \`IDX_c6a48286f3aa8ae903bee0d1e7\` (\`organizationId\`), INDEX \`IDX_96dfbcaa2990df01fe5bb39ccc\` (\`profile_link\`), INDEX \`IDX_f4b0d329c4a3cf79ffe9d56504\` (\`userId\`), INDEX \`IDX_1c0c1370ecd98040259625e17e\` (\`contactId\`), INDEX \`IDX_5e719204dcafa8d6b2ecdeda13\` (\`organizationPositionId\`), UNIQUE INDEX \`REL_f4b0d329c4a3cf79ffe9d56504\` (\`userId\`), UNIQUE INDEX \`REL_1c0c1370ecd98040259625e17e\` (\`contactId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`equipment_sharing_policy\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, INDEX \`IDX_0f3ee47a5fb7192d5eb00c71ae\` (\`isActive\`), INDEX \`IDX_b0fc293cf47f31ba512fd29bf0\` (\`isArchived\`), INDEX \`IDX_5443ca8ed830626656d8cfecef\` (\`tenantId\`), INDEX \`IDX_5311a833ff255881454bd5b3b5\` (\`organizationId\`), INDEX \`IDX_04c9e514ed70897f6ad8cadc3c\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`equipment_sharing\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NULL, \`shareRequestDay\` datetime NULL, \`shareStartDay\` datetime NULL, \`shareEndDay\` datetime NULL, \`status\` int NOT NULL, \`createdBy\` varchar(255) NULL, \`createdByName\` varchar(255) NULL, \`equipmentId\` varchar(255) NULL, \`equipmentSharingPolicyId\` varchar(255) NULL, INDEX \`IDX_70ff31cefa0f578f6fa82d2bcc\` (\`isActive\`), INDEX \`IDX_a734598f5637cf1501288331e3\` (\`isArchived\`), INDEX \`IDX_fa525e61fb3d8d9efec0f364a4\` (\`tenantId\`), INDEX \`IDX_ea9254be07ae4a8604f0aaab19\` (\`organizationId\`), INDEX \`IDX_acad51a6362806fc499e583e40\` (\`equipmentId\`), INDEX \`IDX_0ecfe0ce0cd2b197249d5f1c10\` (\`equipmentSharingPolicyId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`equipment\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`type\` varchar(255) NOT NULL, \`serialNumber\` varchar(255) NOT NULL, \`manufacturedYear\` decimal NULL, \`initialCost\` decimal NULL, \`currency\` varchar(255) NOT NULL, \`maxSharePeriod\` decimal NULL, \`autoApproveShare\` tinyint NOT NULL, \`imageId\` varchar(36) NULL, INDEX \`IDX_39e1b443404ea7fa42b3d36ccb\` (\`isActive\`), INDEX \`IDX_d8452bfe9f18ced4ce76c4b70b\` (\`isArchived\`), INDEX \`IDX_fb6808468066849ab7b7454d5f\` (\`tenantId\`), INDEX \`IDX_f98ce0d210aa9f91b729d44780\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`estimate_email\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`token\` varchar(255) NOT NULL, \`email\` varchar(255) NOT NULL, \`expireDate\` datetime NOT NULL, \`convertAcceptedEstimates\` tinyint NULL, INDEX \`IDX_1a4bd2a8034bb1309b4ea87882\` (\`isActive\`), INDEX \`IDX_f1fac79e17c475f00daa4db3d2\` (\`isArchived\`), INDEX \`IDX_391d3f83244fea73c619aecadd\` (\`tenantId\`), INDEX \`IDX_233c1d351d63441aeb039d1164\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`event_type\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`duration\` decimal NOT NULL, \`durationUnit\` varchar(255) NULL, \`title\` varchar(255) NULL, \`description\` varchar(255) NULL, \`employeeId\` varchar(255) NULL, INDEX \`IDX_f14eee32875b112fab1139b332\` (\`isActive\`), INDEX \`IDX_613cfa5783e164cad10dc27e58\` (\`isArchived\`), INDEX \`IDX_92fc62260c0c7ff108622850bf\` (\`tenantId\`), INDEX \`IDX_fc8818d6fde74370ec703a0135\` (\`organizationId\`), INDEX \`IDX_4b02d8616129f39fca2b10e98b\` (\`duration\`), INDEX \`IDX_9d5980ff1064e2edb77509d312\` (\`durationUnit\`), INDEX \`IDX_43459c650957e478203c738574\` (\`title\`), INDEX \`IDX_5bde7aeb2c7fb3a421b175871e\` (\`description\`), INDEX \`IDX_24d905ec9e127ade23754a363d\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`expense_category\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, INDEX \`IDX_8376e41fd82aba147a433dc097\` (\`isActive\`), INDEX \`IDX_e9cef5d359dfa48ee5d0cd5fcc\` (\`isArchived\`), INDEX \`IDX_37504e920ee5ca46a4000b89da\` (\`tenantId\`), INDEX \`IDX_9c9bfe5baaf83f53533ff035fc\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`expense\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`amount\` decimal NOT NULL, \`typeOfExpense\` varchar(255) NULL, \`notes\` varchar(255) NULL, \`currency\` varchar(255) NOT NULL, \`valueDate\` datetime NULL, \`purpose\` varchar(255) NULL, \`taxType\` varchar(255) NULL, \`taxLabel\` varchar(255) NULL, \`rateValue\` decimal NULL, \`receipt\` varchar(255) NULL, \`splitExpense\` tinyint NULL, \`reference\` varchar(255) NULL, \`status\` enum ('INVOICED', 'UNINVOICED', 'PAID', 'NOT_BILLABLE') NULL, \`employeeId\` varchar(255) NULL, \`vendorId\` varchar(255) NULL, \`categoryId\` varchar(255) NULL, \`projectId\` varchar(255) NULL, \`organizationContactId\` varchar(255) NULL, INDEX \`IDX_1aa0e5fd480214ae4851471e3c\` (\`isActive\`), INDEX \`IDX_d77aeb93f2439ebdf4babaab4c\` (\`isArchived\`), INDEX \`IDX_6d171c9d5f81095436b99da5e6\` (\`tenantId\`), INDEX \`IDX_c5fb146726ff128e600f23d0a1\` (\`organizationId\`), INDEX \`IDX_846a933af451a33b95b7b198c6\` (\`amount\`), INDEX \`IDX_b5bb8f62d401475fcc8c2ba35e\` (\`typeOfExpense\`), INDEX \`IDX_3826d6ca74a08a8498fa17d330\` (\`notes\`), INDEX \`IDX_89508d119b1a279c037d9da151\` (\`currency\`), INDEX \`IDX_cbfebdb1419f9b8036a8b0546e\` (\`purpose\`), INDEX \`IDX_dd8ab9312fb8d787982b9feebf\` (\`taxType\`), INDEX \`IDX_0006d3025b6c92fbd4089b9465\` (\`taxLabel\`), INDEX \`IDX_97ed0e2b80f2e7ec260fd81cd9\` (\`rateValue\`), INDEX \`IDX_5f57d077c28b378a6c885e81c5\` (\`receipt\`), INDEX \`IDX_5e7b197dbac69012dbdb4964f3\` (\`employeeId\`), INDEX \`IDX_eacb116ab0521ad9b96f2bb53b\` (\`vendorId\`), INDEX \`IDX_42eea5debc63f4d1bf89881c10\` (\`categoryId\`), INDEX \`IDX_9971c4171ae051e74b833984a3\` (\`projectId\`), INDEX \`IDX_047b8b5c0782d5a6d4c8bfc1a4\` (\`organizationContactId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`import-history\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`file\` varchar(255) NOT NULL, \`path\` varchar(255) NOT NULL, \`size\` int NULL, \`status\` varchar(255) NOT NULL, \`importDate\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX \`IDX_e339340014a6c4e2f57be00b0c\` (\`isActive\`), INDEX \`IDX_d6a626bee6cddf4bc53a493bc3\` (\`isArchived\`), INDEX \`IDX_54868607115e2fee3b0b764eec\` (\`tenantId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`import-record\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`entityType\` varchar(255) NOT NULL, \`sourceId\` varchar(255) NOT NULL, \`destinationId\` varchar(255) NOT NULL, \`importDate\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX \`IDX_b90957ef81e74c43d6ae037560\` (\`isActive\`), INDEX \`IDX_339328a7247aa09d061c642ae1\` (\`isArchived\`), INDEX \`IDX_a43b235c35c2c4d3263ada770c\` (\`tenantId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`feature_organization\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`isEnabled\` tinyint NOT NULL DEFAULT 1, \`featureId\` varchar(255) NOT NULL, INDEX \`IDX_4ee685760ddb60ff71f763d8f6\` (\`isActive\`), INDEX \`IDX_e4c142f37091b47056012d34ba\` (\`isArchived\`), INDEX \`IDX_8f71803d96dcdbcc6b19bb28d3\` (\`tenantId\`), INDEX \`IDX_6a94e6b0a572f591288ac44a42\` (\`organizationId\`), INDEX \`IDX_6d413f9fdd5366b1b9add46483\` (\`featureId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`feature\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`name\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, \`isPaid\` tinyint NOT NULL DEFAULT 0, \`description\` varchar(255) NULL, \`image\` varchar(255) NULL, \`link\` varchar(255) NOT NULL, \`status\` varchar(255) NULL, \`icon\` varchar(255) NULL, \`parentId\` varchar(255) NULL, INDEX \`IDX_5405b67f1df904831a358df7c4\` (\`isActive\`), INDEX \`IDX_a26cc341268d22bd55f06e3ef6\` (\`isArchived\`), INDEX \`IDX_4832be692a2dc63d67e8e93c75\` (\`name\`), INDEX \`IDX_c30465b5a6e0fae1c8ee7e3120\` (\`code\`), INDEX \`IDX_d4a28a8e70d450a412bf0cfb52\` (\`parentId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`goal_general_setting\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`maxObjectives\` int NOT NULL, \`maxKeyResults\` int NOT NULL, \`employeeCanCreateObjective\` tinyint NOT NULL, \`canOwnObjectives\` varchar(255) NOT NULL, \`canOwnKeyResult\` varchar(255) NOT NULL, \`krTypeKPI\` tinyint NOT NULL, \`krTypeTask\` tinyint NOT NULL, INDEX \`IDX_bdee8704ebeb79368ff6154fc7\` (\`isActive\`), INDEX \`IDX_4a44905db4ca1e40b62021fdfb\` (\`isArchived\`), INDEX \`IDX_d17a5159d888ac6320459eda39\` (\`tenantId\`), INDEX \`IDX_e35d0f7b794ca8850669d12c78\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`goal_kpi_template\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`type\` varchar(255) NOT NULL, \`unit\` varchar(255) NULL, \`operator\` varchar(255) NOT NULL, \`currentValue\` int NOT NULL, \`targetValue\` int NOT NULL, \`leadId\` varchar(36) NULL, INDEX \`IDX_b4f4701ddb0e973602445ed1c6\` (\`isActive\`), INDEX \`IDX_26311c417ba945c901c65d515d\` (\`isArchived\`), INDEX \`IDX_cc72d4e8e4284dcc8ffbf96caf\` (\`tenantId\`), INDEX \`IDX_df7ab026698c02859ff7540809\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`goal_kpi\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`type\` varchar(255) NOT NULL, \`unit\` varchar(255) NULL, \`operator\` varchar(255) NOT NULL, \`currentValue\` int NOT NULL, \`targetValue\` int NOT NULL, \`leadId\` varchar(255) NULL, INDEX \`IDX_cfc393bd9835d8259e73019226\` (\`isActive\`), INDEX \`IDX_a96c22c51607f878c8a98bc488\` (\`isArchived\`), INDEX \`IDX_43aa2985216560cd9fa93f501e\` (\`tenantId\`), INDEX \`IDX_e49e37fe88a2725a38a3b05849\` (\`organizationId\`), INDEX \`IDX_d4f093ca4eb7c40db68d9a789d\` (\`leadId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`goal_template\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`level\` varchar(255) NOT NULL, \`category\` varchar(255) NOT NULL, INDEX \`IDX_cd91c5925942061527b1bc112c\` (\`isActive\`), INDEX \`IDX_056e869152a335f88c38c5b693\` (\`isArchived\`), INDEX \`IDX_774bf82989475befe301fe1bca\` (\`tenantId\`), INDEX \`IDX_5708fe06608c72fc77b65ae651\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`goal_time_frame\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`status\` varchar(255) NOT NULL, \`startDate\` datetime NOT NULL, \`endDate\` datetime NOT NULL, INDEX \`IDX_646565982726362cc2ca4fb807\` (\`isActive\`), INDEX \`IDX_ef4ec26ca3a7e0d8c9e1748be2\` (\`isArchived\`), INDEX \`IDX_b56723b53a76ca1c171890c479\` (\`tenantId\`), INDEX \`IDX_405bc5bba9ed71aefef84a29f1\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`goal\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NOT NULL, \`deadline\` varchar(255) NOT NULL, \`level\` varchar(255) NOT NULL, \`progress\` int NOT NULL, \`ownerTeamId\` varchar(255) NULL, \`ownerEmployeeId\` varchar(255) NULL, \`leadId\` varchar(255) NULL, \`alignedKeyResultId\` varchar(255) NULL, INDEX \`IDX_72641ffde44e1a1627aa2d040f\` (\`isActive\`), INDEX \`IDX_4a2c00a44350a063d75be80ba9\` (\`isArchived\`), INDEX \`IDX_6b4758a5442713070c9a366d0e\` (\`tenantId\`), INDEX \`IDX_c6e8ae55a4db3584686cbf6afe\` (\`organizationId\`), INDEX \`IDX_ac161c1a0c0ff8e83554f097e5\` (\`ownerTeamId\`), INDEX \`IDX_35526ff1063ab5fa2b20e71bd6\` (\`ownerEmployeeId\`), INDEX \`IDX_af0a11734e70412b742ac339c8\` (\`leadId\`), INDEX \`IDX_4c8b4e887a994182fd6132e640\` (\`alignedKeyResultId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`image_asset\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NULL, \`url\` varchar(255) NOT NULL, \`thumb\` varchar(255) NULL, \`width\` int NOT NULL DEFAULT '0', \`height\` int NOT NULL DEFAULT '0', \`size\` decimal NULL, \`isFeatured\` tinyint NOT NULL DEFAULT 0, \`externalProviderId\` varchar(255) NULL, \`storageProvider\` enum ('LOCAL', 'S3', 'WASABI', 'CLOUDINARY') NULL, INDEX \`IDX_9d44ce9eb8689e578b941a6a54\` (\`isActive\`), INDEX \`IDX_af1a212cb378bb0eed51c1b2bc\` (\`isArchived\`), INDEX \`IDX_01856a9a730b7e79d70aa661cb\` (\`tenantId\`), INDEX \`IDX_d3675304df9971cccf96d9a7c3\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`income\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`amount\` decimal NOT NULL, \`currency\` varchar(255) NOT NULL, \`valueDate\` datetime NULL, \`notes\` varchar(255) NULL, \`isBonus\` tinyint NULL, \`reference\` varchar(255) NULL, \`employeeId\` varchar(255) NULL, \`clientId\` varchar(255) NULL, INDEX \`IDX_904ab9ee6ac5e74bf3616c8ccb\` (\`isActive\`), INDEX \`IDX_aedb8b1d10c498309bed9edf53\` (\`isArchived\`), INDEX \`IDX_8608b275644cfc7a0f3f585081\` (\`tenantId\`), INDEX \`IDX_64409de4711cd14e2c43371cc0\` (\`organizationId\`), INDEX \`IDX_bd39a647a2843177723ddf733e\` (\`amount\`), INDEX \`IDX_86b5a121b3775a1b0b7fa75680\` (\`currency\`), INDEX \`IDX_20207d9f915066dfbc2210bcf1\` (\`notes\`), INDEX \`IDX_a05d52b7ffe89140f9cbcf114b\` (\`employeeId\`), INDEX \`IDX_29fbd3a17710a27e6f856072c0\` (\`clientId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`integration_entity_setting_tied\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entity\` varchar(255) NOT NULL, \`sync\` tinyint NOT NULL, \`integrationEntitySettingId\` varchar(255) NULL, INDEX \`IDX_6d43cc33c80221dbe4854b38e6\` (\`isActive\`), INDEX \`IDX_101cd83aa75949cfb5b8eec084\` (\`isArchived\`), INDEX \`IDX_b208a754c7a538cb3422f39f5b\` (\`tenantId\`), INDEX \`IDX_d5ac36aa3d5919908414154fca\` (\`organizationId\`), INDEX \`IDX_3fb863167095805e33f38a0fdc\` (\`integrationEntitySettingId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`integration_entity_setting\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entity\` varchar(255) NOT NULL, \`sync\` tinyint NOT NULL, \`integrationId\` varchar(255) NOT NULL, INDEX \`IDX_e3d407c5532edaceaa4df34623\` (\`isActive\`), INDEX \`IDX_1c653ebceca3b9c8766131db91\` (\`isArchived\`), INDEX \`IDX_23e9cfcf1bfff07dcc3254378d\` (\`tenantId\`), INDEX \`IDX_c6c01e38eebd8b26b9214b9044\` (\`organizationId\`), INDEX \`IDX_f80ff4ebbf0b33a67dce598911\` (\`integrationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`integration_map\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entity\` varchar(255) NOT NULL, \`sourceId\` varchar(255) NOT NULL, \`gauzyId\` varchar(255) NOT NULL, \`integrationId\` varchar(255) NOT NULL, INDEX \`IDX_c79464c4ccf7e5195d69675c15\` (\`isActive\`), INDEX \`IDX_e63f4791631e7572ca213ac4a4\` (\`isArchived\`), INDEX \`IDX_eec3d6064578610ddc609dd360\` (\`tenantId\`), INDEX \`IDX_7022dafd72c1b92f7d50691441\` (\`organizationId\`), INDEX \`IDX_c327ea26bda3d349a1eceb5658\` (\`integrationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`integration_setting\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`settingsName\` varchar(255) NOT NULL, \`settingsValue\` varchar(255) NOT NULL, \`integrationId\` varchar(255) NOT NULL, INDEX \`IDX_97c0d54aae21ccdbb5c3581642\` (\`isActive\`), INDEX \`IDX_f515574f1251562c52fe25b6a3\` (\`isArchived\`), INDEX \`IDX_954c6b05297814776d9cb66ca7\` (\`tenantId\`), INDEX \`IDX_369eaafb13afe9903a170077ed\` (\`organizationId\`), INDEX \`IDX_34daf030004ad37b88f1f3d863\` (\`integrationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`integration_tenant\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`lastSyncedAt\` datetime NULL DEFAULT CURRENT_TIMESTAMP, \`integrationId\` varchar(255) NULL, INDEX \`IDX_c5ff5d3ab364b7da72bf3fbb46\` (\`isActive\`), INDEX \`IDX_5487f9197c106d774bae20991c\` (\`isArchived\`), INDEX \`IDX_24e37d03ef224f1a16a35069c2\` (\`tenantId\`), INDEX \`IDX_33ab224e7755a46fff5bc1e64e\` (\`organizationId\`), INDEX \`IDX_d0532ed8020981736b58748de6\` (\`lastSyncedAt\`), INDEX \`IDX_0d6ddc27d687ca879042c5f3ce\` (\`integrationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_github_repository\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`repositoryId\` int NOT NULL, \`name\` varchar(255) NOT NULL, \`fullName\` varchar(255) NOT NULL, \`owner\` varchar(255) NOT NULL, \`issuesCount\` int NULL, \`hasSyncEnabled\` tinyint NULL DEFAULT 1, \`private\` tinyint NULL DEFAULT 0, \`status\` varchar(255) NULL, \`integrationId\` varchar(255) NULL, INDEX \`IDX_5e97728cfda96f49cc7f95bbaf\` (\`isActive\`), INDEX \`IDX_ef65338e8597b9f56fd0fe3c94\` (\`isArchived\`), INDEX \`IDX_480158f21938444e4f62fb3185\` (\`tenantId\`), INDEX \`IDX_69d75a47af6bfcda545a865691\` (\`organizationId\`), INDEX \`IDX_ca0fa80f50baed7287a499dc2c\` (\`repositoryId\`), INDEX \`IDX_6eea42a69e130bbd14b7ea3659\` (\`name\`), INDEX \`IDX_a146e202c19f521bf5ec69bb26\` (\`fullName\`), INDEX \`IDX_9e8a77c1d330554fab9230100a\` (\`owner\`), INDEX \`IDX_04717f25bea7d9cef0d51cac50\` (\`issuesCount\`), INDEX \`IDX_34c48d11eb82ef42e89370bdc7\` (\`hasSyncEnabled\`), INDEX \`IDX_2eec784cadcb7847b64937fb58\` (\`private\`), INDEX \`IDX_59407d03d189560ac1a0a4b0eb\` (\`status\`), INDEX \`IDX_add7dbec156589dd0b27e2e0c4\` (\`integrationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_github_repository_issue\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`issueId\` int NOT NULL, \`issueNumber\` int NOT NULL, \`repositoryId\` varchar(255) NULL, INDEX \`IDX_d706210d377ece2a1bc3386388\` (\`isActive\`), INDEX \`IDX_c774c276d6b7ea05a7e12d3c81\` (\`isArchived\`), INDEX \`IDX_b3234be5b70c2362cdf67bb188\` (\`tenantId\`), INDEX \`IDX_6c8e119fc6a2a7d3413aa76d3b\` (\`organizationId\`), INDEX \`IDX_055f310a04a928343494a5255a\` (\`issueId\`), INDEX \`IDX_a8709a9c5cc142c6fbe92df274\` (\`issueNumber\`), INDEX \`IDX_5065401113abb6e9608225e567\` (\`repositoryId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`integration_type\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`icon\` varchar(255) NULL, \`groupName\` varchar(255) NOT NULL, \`order\` int NOT NULL, INDEX \`IDX_34a49d941459e1031c766b941f\` (\`isActive\`), INDEX \`IDX_e7b65ef60492b1c34007736f99\` (\`isArchived\`), UNIQUE INDEX \`IDX_83443d669822bbbf2bd0ebdacd\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`integration\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`name\` varchar(255) NOT NULL, \`provider\` varchar(255) NULL, \`redirectUrl\` varchar(255) NULL, \`imgSrc\` varchar(255) NULL, \`isComingSoon\` tinyint NOT NULL DEFAULT 0, \`isPaid\` tinyint NOT NULL DEFAULT 0, \`version\` varchar(255) NULL, \`docUrl\` varchar(255) NULL, \`isFreeTrial\` tinyint NOT NULL DEFAULT 0, \`freeTrialPeriod\` decimal NULL DEFAULT '0', \`order\` int NULL, INDEX \`IDX_24981cd300007cf88601c2d616\` (\`isActive\`), INDEX \`IDX_85d7b0f07f3e3707b4586670a9\` (\`isArchived\`), UNIQUE INDEX \`IDX_52d7fa32a7832b377fc2d7f619\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`invite\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`token\` varchar(255) NOT NULL, \`email\` varchar(255) NOT NULL, \`status\` varchar(255) NOT NULL, \`expireDate\` datetime NULL, \`actionDate\` datetime NULL, \`code\` varchar(255) NULL, \`fullName\` varchar(255) NULL, \`invitedById\` varchar(255) NULL, \`roleId\` varchar(255) NULL, \`userId\` varchar(255) NULL, INDEX \`IDX_bd44bcb10034bc0c5fe4427b3e\` (\`isActive\`), INDEX \`IDX_3cef860504647ccd52d39d7dc2\` (\`isArchived\`), INDEX \`IDX_7c2328f76efb850b8114797247\` (\`tenantId\`), INDEX \`IDX_68eef4ab86b67747f24f288a16\` (\`organizationId\`), INDEX \`IDX_5a182e8b3e225b14ddf6df7e6c\` (\`invitedById\`), INDEX \`IDX_900a3ed40499c79c1c289fec28\` (\`roleId\`), INDEX \`IDX_91bfeec7a9574f458e5b592472\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`invoice_estimate_history\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`action\` varchar(255) NOT NULL, \`title\` varchar(255) NULL, \`userId\` varchar(255) NULL, \`invoiceId\` varchar(255) NOT NULL, INDEX \`IDX_483eb296a94d821ebedb375858\` (\`isActive\`), INDEX \`IDX_8106063f79cce8e67790d79092\` (\`isArchived\`), INDEX \`IDX_cc0ac824ba89deda98bb418e8c\` (\`tenantId\`), INDEX \`IDX_856f24297f120604f8ae294276\` (\`organizationId\`), INDEX \`IDX_da2893697d57368470952a76f6\` (\`userId\`), INDEX \`IDX_31ec3d5a6b0985cec544c64217\` (\`invoiceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`invoice_item\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`description\` varchar(255) NULL, \`price\` decimal NOT NULL, \`quantity\` decimal NOT NULL, \`totalValue\` decimal NOT NULL, \`applyTax\` tinyint NULL, \`applyDiscount\` tinyint NULL, \`expenseId\` varchar(255) NULL, \`invoiceId\` varchar(255) NULL, \`taskId\` varchar(255) NULL, \`employeeId\` varchar(255) NULL, \`projectId\` varchar(255) NULL, \`productId\` varchar(255) NULL, INDEX \`IDX_e2835fd8776ae5d56d892e087e\` (\`isActive\`), INDEX \`IDX_b7da14d2b61cf1dd5c65188b9c\` (\`isArchived\`), INDEX \`IDX_f78214cd9de76e80fe8a6305f5\` (\`tenantId\`), INDEX \`IDX_e89749c8e8258b2ec110c0776f\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`invoice\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`invoiceDate\` datetime NULL, \`invoiceNumber\` bigint NULL, \`dueDate\` datetime NULL, \`currency\` varchar(255) NOT NULL, \`discountValue\` decimal NOT NULL, \`paid\` tinyint NULL, \`tax\` decimal NULL, \`tax2\` decimal NULL, \`terms\` varchar(255) NOT NULL, \`totalValue\` decimal NULL, \`status\` varchar(255) NOT NULL, \`isEstimate\` tinyint NULL, \`isAccepted\` tinyint NULL, \`discountType\` varchar(255) NULL, \`taxType\` varchar(255) NULL, \`tax2Type\` varchar(255) NULL, \`invoiceType\` varchar(255) NULL, \`sentTo\` varchar(255) NULL, \`organizationContactId\` varchar(255) NULL, \`internalNote\` varchar(255) NULL, \`alreadyPaid\` decimal NULL, \`amountDue\` decimal NULL, \`hasRemainingAmountInvoiced\` tinyint NULL, \`token\` text NULL, \`fromOrganizationId\` varchar(255) NOT NULL, \`toContactId\` varchar(255) NULL, INDEX \`IDX_850ca385c1985c1808cd4ea241\` (\`isActive\`), INDEX \`IDX_eabacf7474d75e53d7b7046f3e\` (\`isArchived\`), INDEX \`IDX_7fb52a5f267f53b7d93af3d8c3\` (\`tenantId\`), INDEX \`IDX_058ef835f99e28fc6717cd7c80\` (\`organizationId\`), INDEX \`IDX_b5c33892e630b66c65d623baf8\` (\`fromOrganizationId\`), INDEX \`IDX_d9e965da0f63c94983d3a1006a\` (\`toContactId\`), UNIQUE INDEX \`IDX_d7bed97fb47876e03fd7d7c285\` (\`invoiceNumber\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`key_result_template\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`type\` varchar(255) NOT NULL, \`unit\` varchar(255) NULL, \`targetValue\` int NULL, \`initialValue\` int NULL, \`deadline\` varchar(255) NOT NULL, \`kpiId\` varchar(255) NULL, \`goalId\` varchar(255) NULL, INDEX \`IDX_f4e813d72dc732f16497ee2c52\` (\`isActive\`), INDEX \`IDX_aa0e9b0cfcba1926925b025512\` (\`isArchived\`), INDEX \`IDX_86c09eb673b0e66129dbdc7211\` (\`tenantId\`), INDEX \`IDX_fab6b6200b9ed6fd002c1ff62a\` (\`organizationId\`), INDEX \`IDX_46426ea45456e240a092b73204\` (\`goalId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`key_result_update\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`update\` int NOT NULL, \`progress\` int NOT NULL, \`owner\` varchar(255) NOT NULL, \`status\` varchar(255) NOT NULL, \`keyResultId\` varchar(255) NULL, INDEX \`IDX_12b8b54f416ec9f5ec002f0a83\` (\`isActive\`), INDEX \`IDX_94aad97b26aede6545a3226fb3\` (\`isArchived\`), INDEX \`IDX_cd9cbc0d5b6d62dbb63c3b3a65\` (\`tenantId\`), INDEX \`IDX_fd4b0cb7a44ed914acdda55e29\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`key_result\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NOT NULL, \`type\` varchar(255) NOT NULL, \`targetValue\` int NULL, \`initialValue\` int NULL, \`unit\` varchar(255) NULL, \`update\` int NOT NULL, \`progress\` int NOT NULL, \`deadline\` varchar(255) NOT NULL, \`hardDeadline\` datetime NULL, \`softDeadline\` datetime NULL, \`status\` varchar(255) NOT NULL, \`weight\` varchar(255) NULL, \`ownerId\` varchar(255) NOT NULL, \`leadId\` varchar(255) NULL, \`projectId\` varchar(255) NULL, \`taskId\` varchar(255) NULL, \`kpiId\` varchar(255) NULL, \`goalId\` varchar(255) NULL, INDEX \`IDX_9b62dd2dddcde032f46a981733\` (\`isActive\`), INDEX \`IDX_8889e2618366faefa575a8049b\` (\`isArchived\`), INDEX \`IDX_8ac2c6b487d03157adda874789\` (\`tenantId\`), INDEX \`IDX_d1f45ca98f17bd84a5e430feaf\` (\`organizationId\`), INDEX \`IDX_5880347716f9ec5056ec15112c\` (\`ownerId\`), INDEX \`IDX_c89adeff0de3aedb2e772a5bf4\` (\`leadId\`), INDEX \`IDX_38dc003f3484eff4b59918e9ae\` (\`projectId\`), INDEX \`IDX_d8547e21ccb8e37ac9f0d69c1a\` (\`taskId\`), INDEX \`IDX_4e1e975124c1d717814a4bb2ec\` (\`kpiId\`), INDEX \`IDX_3e1d08761a717c1dd71fe67249\` (\`goalId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`language\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`name\` varchar(255) NOT NULL, \`code\` varchar(255) NULL, \`is_system\` tinyint NULL DEFAULT 1, \`description\` varchar(255) NULL, \`color\` varchar(255) NOT NULL, INDEX \`IDX_3a7abee35dfa3c90ed491583eb\` (\`isActive\`), INDEX \`IDX_15fcb8179bc7b0642ca78da69e\` (\`isArchived\`), UNIQUE INDEX \`IDX_465b3173cdddf0ac2d3fe73a33\` (\`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`merchant\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, \`email\` varchar(255) NOT NULL, \`phone\` varchar(255) NULL, \`description\` varchar(255) NULL, \`active\` tinyint NOT NULL DEFAULT 1, \`currency\` varchar(255) NOT NULL DEFAULT 'USD', \`contactId\` varchar(255) NULL, \`logoId\` varchar(255) NULL, INDEX \`IDX_a03be8a86e528e2720504a041f\` (\`isActive\`), INDEX \`IDX_0a0f972564e74c9c4905e3abcb\` (\`isArchived\`), INDEX \`IDX_533144d7ae94180235ea456625\` (\`tenantId\`), INDEX \`IDX_d306a524b507f72fa8550aeffe\` (\`organizationId\`), INDEX \`IDX_e03ddff05652be527e04abdc56\` (\`contactId\`), INDEX \`IDX_20acc3c3a6c900c6ef9fc68199\` (\`logoId\`), UNIQUE INDEX \`REL_e03ddff05652be527e04abdc56\` (\`contactId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_award\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`year\` varchar(255) NOT NULL, INDEX \`IDX_4062b5d54aa740aaff9a6c5fbb\` (\`isActive\`), INDEX \`IDX_34c6749e2bc94b2e52e9572f32\` (\`isArchived\`), INDEX \`IDX_af6423760433da72002a7f369e\` (\`tenantId\`), INDEX \`IDX_2e0d21aab892b5993abaac09bc\` (\`organizationId\`), INDEX \`IDX_31626e7d39eb95b710d5a2d80f\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_contact\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`primaryEmail\` varchar(255) NULL, \`primaryPhone\` varchar(255) NULL, \`inviteStatus\` enum ('NOT_INVITED', 'INVITED', 'ACCEPTED') NULL, \`notes\` varchar(255) NULL, \`contactType\` enum ('CLIENT', 'CUSTOMER', 'LEAD') NOT NULL DEFAULT 'CLIENT', \`imageUrl\` varchar(500) NULL, \`budget\` int NULL, \`budgetType\` enum ('hours', 'cost') NULL DEFAULT 'cost', \`createdBy\` varchar(255) NULL, \`contactId\` varchar(255) NULL, \`imageId\` varchar(255) NULL, INDEX \`IDX_53627a383c9817dbf1164d7dc6\` (\`isActive\`), INDEX \`IDX_f91783c7a8565c648b65635efc\` (\`isArchived\`), INDEX \`IDX_e68c43e315ad3aaea4e99cf461\` (\`tenantId\`), INDEX \`IDX_6200736cb4d3617b004e5b647f\` (\`organizationId\`), INDEX \`IDX_de33f92e042365d196d959e774\` (\`name\`), INDEX \`IDX_a86d2e378b953cb39261f457d2\` (\`contactId\`), INDEX \`IDX_8cfcdc6bc8fb55e273d9ace5fd\` (\`imageId\`), UNIQUE INDEX \`REL_a86d2e378b953cb39261f457d2\` (\`contactId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_department\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, INDEX \`IDX_6139cd4c620e81aefd4895d370\` (\`isActive\`), INDEX \`IDX_b65059949804b20048b1c86c3d\` (\`isArchived\`), INDEX \`IDX_b3644ff7cd65239e29d292a41d\` (\`tenantId\`), INDEX \`IDX_c61a562a2379d1c0077fe7de33\` (\`organizationId\`), INDEX \`IDX_91b652409dc1fb2f712590dd21\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_document\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`documentUrl\` varchar(255) NULL, \`documentId\` varchar(255) NULL, INDEX \`IDX_e5edb48261db95f46c3b4d34a5\` (\`isActive\`), INDEX \`IDX_72c6a8ad9de5c04b2b689fd229\` (\`isArchived\`), INDEX \`IDX_4bc83945c022a862a33629ff1e\` (\`tenantId\`), INDEX \`IDX_1057ec001a4c6b258658143047\` (\`organizationId\`), INDEX \`IDX_c129dee7d1cb84e01e69b5e2c6\` (\`documentId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_employment_type\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, INDEX \`IDX_880f3cce5e03f42bec3da6e6dc\` (\`isActive\`), INDEX \`IDX_cc096d49e2399e89cdf32297da\` (\`isArchived\`), INDEX \`IDX_227b5bd9867287cbbeece8f6ba\` (\`tenantId\`), INDEX \`IDX_a583cfe32f492f5ba99b7bb205\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_language\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`languageCode\` varchar(255) NOT NULL, \`name\` varchar(255) NOT NULL, \`level\` varchar(255) NOT NULL, INDEX \`IDX_b79e8d45a3ef5503579643f5de\` (\`isActive\`), INDEX \`IDX_6577ec9ca4cef331a507264d44\` (\`isArchived\`), INDEX \`IDX_225e476592214e32e117a85213\` (\`tenantId\`), INDEX \`IDX_4513931e2d530f78d7144c8c7c\` (\`organizationId\`), INDEX \`IDX_020516e74a57cb85d75381e841\` (\`languageCode\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_position\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, INDEX \`IDX_7317abf7a05a169783b6aa7932\` (\`isActive\`), INDEX \`IDX_ce8721ddf715f0efa4bd3d2c5f\` (\`isArchived\`), INDEX \`IDX_a8f497b1006ec967964abb0d49\` (\`tenantId\`), INDEX \`IDX_a0409e39f23ff6d418f2c03df5\` (\`organizationId\`), INDEX \`IDX_3f02c20145af9997253531349c\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_project\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`startDate\` datetime NULL, \`endDate\` datetime NULL, \`billing\` varchar(255) NULL, \`currency\` varchar(255) NULL, \`public\` tinyint NULL, \`owner\` varchar(255) NULL, \`taskListType\` varchar(255) NOT NULL DEFAULT 'GRID', \`code\` varchar(255) NULL, \`description\` varchar(255) NULL, \`color\` varchar(255) NULL, \`billable\` tinyint NULL, \`billingFlat\` tinyint NULL, \`openSource\` tinyint NULL, \`projectUrl\` varchar(255) NULL, \`openSourceProjectUrl\` varchar(255) NULL, \`budget\` int NULL, \`budgetType\` enum ('hours', 'cost') NULL DEFAULT 'cost', \`membersCount\` int NULL DEFAULT '0', \`imageUrl\` varchar(500) NULL, \`isTasksAutoSync\` tinyint NULL DEFAULT 1, \`isTasksAutoSyncOnLabel\` tinyint NULL DEFAULT 1, \`syncTag\` varchar(255) NULL, \`repositoryId\` varchar(255) NULL, \`organizationContactId\` varchar(255) NULL, \`imageId\` varchar(255) NULL, INDEX \`IDX_18e22d4b569159bb91dec869aa\` (\`isActive\`), INDEX \`IDX_3590135ac2034d7aa88efa7e52\` (\`isArchived\`), INDEX \`IDX_7cf84e8b5775f349f81a1f3cc4\` (\`tenantId\`), INDEX \`IDX_9d8afc1e1e64d4b7d48dd2229d\` (\`organizationId\`), INDEX \`IDX_37215da8dee9503d759adb3538\` (\`name\`), INDEX \`IDX_c210effeb6314d325bc024d21e\` (\`currency\`), INDEX \`IDX_75855b44250686f84b7c4bc1f1\` (\`isTasksAutoSync\`), INDEX \`IDX_c5c4366237dc2bb176c1503426\` (\`isTasksAutoSyncOnLabel\`), INDEX \`IDX_3e128d30e9910ff920eee4ef37\` (\`syncTag\`), INDEX \`IDX_904ae0b765faef6ba2db8b1e69\` (\`repositoryId\`), INDEX \`IDX_bc1e32c13683dbb16ada1c6da1\` (\`organizationContactId\`), INDEX \`IDX_063324fdceb51f7086e401ed2c\` (\`imageId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_recurring_expense\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`startDay\` int NOT NULL, \`startMonth\` int NOT NULL, \`startYear\` int NOT NULL, \`startDate\` datetime NOT NULL, \`endDay\` int NULL, \`endMonth\` int NULL, \`endYear\` int NULL, \`endDate\` datetime NULL, \`categoryName\` varchar(255) NOT NULL, \`value\` decimal NOT NULL, \`currency\` varchar(255) NOT NULL, \`splitExpense\` tinyint NULL, \`parentRecurringExpenseId\` varchar(255) NULL, INDEX \`IDX_9ad08dbc039d08279dae2dd94e\` (\`isActive\`), INDEX \`IDX_f3ef2000abb9762b138cc5a1b3\` (\`isArchived\`), INDEX \`IDX_0b19a287858af40661bd3eb741\` (\`tenantId\`), INDEX \`IDX_8a12e7a0d47d3c6a6b35f7984e\` (\`organizationId\`), INDEX \`IDX_f1e5497ee6be7ba3f2ee90bf4b\` (\`categoryName\`), INDEX \`IDX_61387780d015923453f4b015b4\` (\`currency\`), INDEX \`IDX_637ac2c467df4bc3b71795a866\` (\`parentRecurringExpenseId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_sprint\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`projectId\` varchar(255) NOT NULL, \`goal\` varchar(255) NULL, \`length\` int NOT NULL DEFAULT '7', \`startDate\` datetime NULL, \`endDate\` datetime NULL, \`dayStart\` int NULL, INDEX \`IDX_5596b4fa7fb2ceb0955580becd\` (\`isActive\`), INDEX \`IDX_76e53f9609ca05477d50980743\` (\`isArchived\`), INDEX \`IDX_f57ad03c4e471bd8530494ea63\` (\`tenantId\`), INDEX \`IDX_8a1fe8afb3aa672bae5993fbe7\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_task_setting\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`isTasksPrivacyEnabled\` tinyint NOT NULL DEFAULT 1, \`isTasksMultipleAssigneesEnabled\` tinyint NOT NULL DEFAULT 1, \`isTasksManualTimeEnabled\` tinyint NOT NULL DEFAULT 1, \`isTasksGroupEstimationEnabled\` tinyint NOT NULL DEFAULT 1, \`isTasksEstimationInHoursEnabled\` tinyint NOT NULL DEFAULT 1, \`isTasksEstimationInStoryPointsEnabled\` tinyint NOT NULL DEFAULT 1, \`isTasksProofOfCompletionEnabled\` tinyint NOT NULL DEFAULT 1, \`tasksProofOfCompletionType\` varchar(255) NOT NULL DEFAULT 'PRIVATE', \`isTasksLinkedEnabled\` tinyint NOT NULL DEFAULT 1, \`isTasksCommentsEnabled\` tinyint NOT NULL DEFAULT 1, \`isTasksHistoryEnabled\` tinyint NOT NULL DEFAULT 1, \`isTasksAcceptanceCriteriaEnabled\` tinyint NOT NULL DEFAULT 1, \`isTasksDraftsEnabled\` tinyint NOT NULL DEFAULT 1, \`isTasksNotifyLeftEnabled\` tinyint NOT NULL DEFAULT 1, \`tasksNotifyLeftPeriodDays\` int NOT NULL DEFAULT '7', \`isTasksAutoCloseEnabled\` tinyint NOT NULL DEFAULT 1, \`tasksAutoClosePeriodDays\` int NOT NULL DEFAULT '7', \`isTasksAutoArchiveEnabled\` tinyint NOT NULL DEFAULT 1, \`tasksAutoArchivePeriodDays\` int NOT NULL DEFAULT '7', \`isTasksAutoStatusEnabled\` tinyint NOT NULL DEFAULT 1, \`projectId\` varchar(255) NULL, \`organizationTeamId\` varchar(255) NULL, INDEX \`IDX_f0e2385b2d5f176f9ed3b6a9e3\` (\`isActive\`), INDEX \`IDX_b7be7e61daf2b5af3232c9c4d6\` (\`isArchived\`), INDEX \`IDX_582768159ef0c749e8552ea9bc\` (\`tenantId\`), INDEX \`IDX_5830901876e426adfc15fb7341\` (\`organizationId\`), INDEX \`IDX_19ab7adf33199bc6f913db277d\` (\`projectId\`), INDEX \`IDX_20a290f166c0810eafbf271717\` (\`organizationTeamId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_team_employee\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`isTrackingEnabled\` tinyint NULL DEFAULT 1, \`activeTaskId\` varchar(255) NULL, \`organizationTeamId\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NOT NULL, \`roleId\` varchar(255) NULL, \`order\` int NULL, INDEX \`IDX_70fcc451944fbde73d223c2af3\` (\`isActive\`), INDEX \`IDX_752d7a0fe6597ee6bbc6502a12\` (\`isArchived\`), INDEX \`IDX_fe12e1b76bbb76209134d9bdc2\` (\`tenantId\`), INDEX \`IDX_d8eba1c0e500c60be1b69c1e77\` (\`organizationId\`), INDEX \`IDX_719aeb37fa7a1dd80d25336a0c\` (\`activeTaskId\`), INDEX \`IDX_8dc83cdd7c519d73afc0d8bdf0\` (\`organizationTeamId\`), INDEX \`IDX_a2a5601d799fbfc29c17b99243\` (\`employeeId\`), INDEX \`IDX_ce83034f38496f5fe3f1979697\` (\`roleId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_team_join_request\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`email\` varchar(255) NOT NULL, \`fullName\` varchar(255) NULL, \`linkAddress\` varchar(255) NULL, \`position\` varchar(255) NULL, \`status\` varchar(255) NULL, \`code\` varchar(255) NULL, \`token\` varchar(255) NULL, \`expiredAt\` datetime NULL, \`userId\` varchar(255) NULL, \`organizationTeamId\` varchar(255) NOT NULL, INDEX \`IDX_29ece7e3bb764028387cdbc888\` (\`isActive\`), INDEX \`IDX_b027ee2cb18245356b8d963d2f\` (\`isArchived\`), INDEX \`IDX_d9529008c733cb90044b8c2ad6\` (\`tenantId\`), INDEX \`IDX_c15823bf3f63b1fe331d9de662\` (\`organizationId\`), INDEX \`IDX_5e73656ce0355347477c42ae19\` (\`userId\`), INDEX \`IDX_171b852be7c1f387eca93775aa\` (\`organizationTeamId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_team\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`color\` varchar(255) NULL, \`emoji\` varchar(255) NULL, \`teamSize\` varchar(255) NULL, \`logo\` varchar(255) NULL, \`prefix\` varchar(255) NULL, \`public\` tinyint NULL DEFAULT 0, \`profile_link\` varchar(255) NULL, \`createdById\` varchar(255) NULL, \`imageId\` varchar(255) NULL, INDEX \`IDX_722d648e0b83267d4a66332ccb\` (\`isActive\`), INDEX \`IDX_38f1d96e8c2d59e4f0f84209ab\` (\`isArchived\`), INDEX \`IDX_176f5ed3c4534f3110d423d569\` (\`tenantId\`), INDEX \`IDX_eef1c19a0cb5321223cfe3286c\` (\`organizationId\`), INDEX \`IDX_103ae3eb65f4b091efc55cb532\` (\`name\`), INDEX \`IDX_e22ab0f1236b1a07785b641727\` (\`profile_link\`), INDEX \`IDX_da625f694eb1e23e585f301008\` (\`createdById\`), INDEX \`IDX_51e91be110fa0b8e70066f5727\` (\`imageId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_vendor\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`email\` varchar(255) NULL, \`phone\` varchar(255) NULL, \`website\` varchar(255) NULL, INDEX \`IDX_04c6320f910056ecb11b147ac8\` (\`isActive\`), INDEX \`IDX_266972cd6ff9656eec8818e12d\` (\`isArchived\`), INDEX \`IDX_7e0bf6063e1728c9813d5da7ca\` (\`tenantId\`), INDEX \`IDX_56dd132aa3743cfa9b034d020e\` (\`organizationId\`), INDEX \`IDX_e56e80136b07ecd52545368611\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`isDefault\` tinyint NOT NULL DEFAULT 0, \`profile_link\` varchar(255) NULL, \`banner\` varchar(255) NULL, \`totalEmployees\` int NULL, \`short_description\` varchar(255) NULL, \`client_focus\` varchar(255) NULL, \`overview\` varchar(255) NULL, \`imageUrl\` varchar(500) NULL, \`currency\` varchar(255) NOT NULL, \`valueDate\` datetime NULL, \`defaultValueDateType\` enum ('TODAY', 'END_OF_MONTH', 'START_OF_MONTH') NULL DEFAULT 'TODAY', \`defaultAlignmentType\` varchar(255) NULL, \`timeZone\` varchar(255) NULL, \`regionCode\` varchar(255) NULL, \`brandColor\` varchar(255) NULL, \`dateFormat\` varchar(255) NULL, \`officialName\` varchar(255) NULL, \`startWeekOn\` varchar(255) NULL, \`taxId\` varchar(255) NULL, \`numberFormat\` varchar(255) NULL, \`minimumProjectSize\` varchar(255) NULL, \`bonusType\` varchar(255) NULL, \`bonusPercentage\` int NULL, \`invitesAllowed\` tinyint NULL DEFAULT 1, \`show_income\` tinyint NULL, \`show_profits\` tinyint NULL, \`show_bonuses_paid\` tinyint NULL, \`show_total_hours\` tinyint NULL, \`show_minimum_project_size\` tinyint NULL, \`show_projects_count\` tinyint NULL, \`show_clients_count\` tinyint NULL, \`show_clients\` tinyint NULL, \`show_employees_count\` tinyint NULL, \`inviteExpiryPeriod\` int NULL, \`fiscalStartDate\` datetime NULL, \`fiscalEndDate\` datetime NULL, \`registrationDate\` datetime NULL, \`futureDateAllowed\` tinyint NULL, \`allowManualTime\` tinyint NOT NULL DEFAULT 1, \`allowModifyTime\` tinyint NOT NULL DEFAULT 1, \`allowDeleteTime\` tinyint NOT NULL DEFAULT 1, \`allowTrackInactivity\` tinyint NOT NULL DEFAULT 1, \`inactivityTimeLimit\` int NOT NULL DEFAULT '10', \`activityProofDuration\` int NOT NULL DEFAULT '1', \`requireReason\` tinyint NOT NULL DEFAULT 0, \`requireDescription\` tinyint NOT NULL DEFAULT 0, \`requireProject\` tinyint NOT NULL DEFAULT 0, \`requireTask\` tinyint NOT NULL DEFAULT 0, \`requireClient\` tinyint NOT NULL DEFAULT 0, \`timeFormat\` int NOT NULL DEFAULT '12', \`separateInvoiceItemTaxAndDiscount\` tinyint NULL, \`website\` varchar(255) NULL, \`fiscalInformation\` varchar(255) NULL, \`currencyPosition\` varchar(255) NOT NULL DEFAULT 'LEFT', \`discountAfterTax\` tinyint NULL, \`defaultStartTime\` varchar(255) NULL, \`defaultEndTime\` varchar(255) NULL, \`defaultInvoiceEstimateTerms\` varchar(255) NULL, \`convertAcceptedEstimates\` tinyint NULL, \`daysUntilDue\` int NULL, \`isRemoveIdleTime\` tinyint NOT NULL DEFAULT 0, \`allowScreenshotCapture\` tinyint NOT NULL DEFAULT 1, \`upworkOrganizationId\` varchar(255) NULL, \`upworkOrganizationName\` varchar(255) NULL, \`randomScreenshot\` tinyint NULL DEFAULT 0, \`trackOnSleep\` tinyint NULL DEFAULT 0, \`screenshotFrequency\` decimal NOT NULL DEFAULT '10', \`enforced\` tinyint NULL DEFAULT 0, \`contactId\` varchar(255) NULL, \`imageId\` varchar(255) NULL, INDEX \`IDX_6de52b8f3de32abee3df2628a3\` (\`isActive\`), INDEX \`IDX_b2091c1795f1d0d919b278ab23\` (\`isArchived\`), INDEX \`IDX_745a293c8b2c750bc421fa0633\` (\`tenantId\`), INDEX \`IDX_c21e615583a3ebbb0977452afb\` (\`name\`), INDEX \`IDX_03e5eecc2328eb545ff748cbdd\` (\`isDefault\`), INDEX \`IDX_40460ab803bf6e5a62b75a35c5\` (\`profile_link\`), INDEX \`IDX_6cc2b2052744e352834a4c9e78\` (\`banner\`), INDEX \`IDX_b03a8a28f6ebdb6df8f630216b\` (\`totalEmployees\`), INDEX \`IDX_f37d866c3326eca5f579cef35c\` (\`short_description\`), INDEX \`IDX_c75285bf286b17c7ca5537857b\` (\`client_focus\`), INDEX \`IDX_9ea70bf5c390b00e7bb96b86ed\` (\`overview\`), INDEX \`IDX_15458cef74076623c270500053\` (\`currency\`), INDEX \`IDX_2360aa7a4b5ab99e026584f305\` (\`defaultValueDateType\`), INDEX \`IDX_7965db2b12872551b586f76dd7\` (\`contactId\`), INDEX \`IDX_47b6a97e09895a06606a4a8042\` (\`imageId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`password_reset\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`email\` varchar(255) NOT NULL, \`token\` varchar(255) NOT NULL, INDEX \`IDX_380c03025a41ad032191f1ef2d\` (\`isActive\`), INDEX \`IDX_e71a736d52820b568f6b0ca203\` (\`isArchived\`), INDEX \`IDX_1fa632f2d12a06ef8dcc00858f\` (\`tenantId\`), INDEX \`IDX_1c88db6e50f0704688d1f1978c\` (\`email\`), INDEX \`IDX_36e929b98372d961bb63bd4b4e\` (\`token\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`payment\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`paymentDate\` datetime NULL, \`amount\` decimal NULL, \`note\` varchar(255) NULL, \`currency\` varchar(255) NOT NULL, \`paymentMethod\` enum ('BANK_TRANSFER', 'CASH', 'CHEQUE', 'CREDIT_CARD', 'DEBIT', 'ONLINE') NULL, \`overdue\` tinyint NULL, \`employeeId\` varchar(255) NULL, \`invoiceId\` varchar(255) NULL, \`recordedById\` varchar(255) NOT NULL, \`projectId\` varchar(255) NULL, \`organizationContactId\` varchar(255) NULL, INDEX \`IDX_16a49d62227bf23686b77b5a21\` (\`isActive\`), INDEX \`IDX_8c4018eab11e92c3b09583495f\` (\`isArchived\`), INDEX \`IDX_6959c37c3acf0832103a253570\` (\`tenantId\`), INDEX \`IDX_be7fcc9fb8cd5a74cb602ec6c9\` (\`organizationId\`), INDEX \`IDX_62ef561a3bb084a7d12dad8a2d\` (\`employeeId\`), INDEX \`IDX_87223c7f1d4c2ca51cf6992784\` (\`invoiceId\`), INDEX \`IDX_3f13c738eff604a85700746ec7\` (\`recordedById\`), INDEX \`IDX_8846e403ec45e1ad8c309f91a3\` (\`projectId\`), INDEX \`IDX_82753b9e315af84b20eaf84d77\` (\`organizationContactId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`pipeline_stage\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`description\` text NULL, \`index\` int NOT NULL, \`name\` varchar(255) NOT NULL, \`pipelineId\` varchar(255) NOT NULL, INDEX \`IDX_a6acee4ad726734b73f3886c14\` (\`isActive\`), INDEX \`IDX_074caa106ee22d5d675a696a98\` (\`isArchived\`), INDEX \`IDX_28965bf63ad4c0976892d0fd5e\` (\`tenantId\`), INDEX \`IDX_04d16bdd72668de12c3e41a85a\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`pipeline\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`description\` text NULL, \`name\` varchar(255) NOT NULL, INDEX \`IDX_f3027eabd451ec18b93fab7ed5\` (\`isActive\`), INDEX \`IDX_1adf9f97094bc93e176ede2482\` (\`isArchived\`), INDEX \`IDX_683274c59fb08b21249096e305\` (\`tenantId\`), INDEX \`IDX_873ade98fbd6ca71c8b4d1bbca\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_category_translation\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`languageCode\` varchar(255) NOT NULL, \`referenceId\` varchar(255) NOT NULL, INDEX \`IDX_e690dd59b69e74a6bb5d94f32b\` (\`isActive\`), INDEX \`IDX_d32c5d5e4451acf44fd5b212ce\` (\`isArchived\`), INDEX \`IDX_27d71aa2e843f07fbf36329be3\` (\`tenantId\`), INDEX \`IDX_e46203bf1dbf3291d174f02cb3\` (\`organizationId\`), INDEX \`IDX_586294149d24cd835678878ef1\` (\`referenceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_category\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`imageUrl\` varchar(255) NULL, \`imageId\` varchar(255) NULL, INDEX \`IDX_198fba43f049ea621407e7d188\` (\`isActive\`), INDEX \`IDX_06cd3959f09e0b12793a763515\` (\`isArchived\`), INDEX \`IDX_0a0cf25cd8232a154d1cce2641\` (\`tenantId\`), INDEX \`IDX_853302351eaa4daa39920c270a\` (\`organizationId\`), INDEX \`IDX_f38e86bd280ff9c9c7d9cb7839\` (\`imageId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_option_group\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`productId\` varchar(255) NOT NULL, INDEX \`IDX_0fc743f2bc16502dbc5e85420c\` (\`isActive\`), INDEX \`IDX_76bda4c33c83614617278617ae\` (\`isArchived\`), INDEX \`IDX_462a7fd3ce68935cf973c6709f\` (\`tenantId\`), INDEX \`IDX_4a1430a01b71ecdfcd54b2b6c5\` (\`organizationId\`), INDEX \`IDX_a6e91739227bf4d442f23c52c7\` (\`productId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_option_group_translation\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`languageCode\` varchar(255) NOT NULL, \`referenceId\` varchar(255) NOT NULL, INDEX \`IDX_75b7065234a6d32fbd03d8703f\` (\`isActive\`), INDEX \`IDX_e9e50109d3054fb81205c0a74e\` (\`isArchived\`), INDEX \`IDX_fd6b39f1fd1db026b5dcc3c795\` (\`tenantId\`), INDEX \`IDX_0e2fcc31743e20a45fc3cf0211\` (\`organizationId\`), INDEX \`IDX_c9ce1da98b6d93293daafee63a\` (\`referenceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_option_translation\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`languageCode\` varchar(255) NOT NULL, \`referenceId\` varchar(255) NOT NULL, INDEX \`IDX_f284f666950392c55afa0806c8\` (\`isActive\`), INDEX \`IDX_2f581c3477a5c7a66de5d7f264\` (\`isArchived\`), INDEX \`IDX_9869d7680f48487e584f5d2fca\` (\`tenantId\`), INDEX \`IDX_4dc2f466cfa3d0b7fef19d1273\` (\`organizationId\`), INDEX \`IDX_f43c46e12db0580af320db7738\` (\`referenceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_option\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(255) NULL, \`groupId\` varchar(255) NOT NULL, INDEX \`IDX_d81028785f188c253e0bd49a03\` (\`isActive\`), INDEX \`IDX_35d083f4ecfe72cce72ee88f58\` (\`isArchived\`), INDEX \`IDX_985d235aa5394937c4493262c7\` (\`tenantId\`), INDEX \`IDX_47ffb82a65c43f102b7e0efa41\` (\`organizationId\`), INDEX \`IDX_a6debf9198e2fbfa006aa10d71\` (\`groupId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_variant_setting\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`isSubscription\` tinyint NOT NULL DEFAULT 0, \`isPurchaseAutomatically\` tinyint NOT NULL DEFAULT 0, \`canBeSold\` tinyint NOT NULL DEFAULT 1, \`canBePurchased\` tinyint NOT NULL DEFAULT 1, \`canBeCharged\` tinyint NOT NULL DEFAULT 0, \`canBeRented\` tinyint NOT NULL DEFAULT 0, \`isEquipment\` tinyint NOT NULL DEFAULT 0, \`trackInventory\` tinyint NOT NULL DEFAULT 0, \`productVariantId\` varchar(36) NULL, INDEX \`IDX_ad107ba78e487cd8b13313593b\` (\`isActive\`), INDEX \`IDX_ae78776111e1906accfd61511d\` (\`isArchived\`), INDEX \`IDX_2efe48435d4ba480a4bb8b96fa\` (\`tenantId\`), INDEX \`IDX_bed9d45e15866d9b8e87e7a7bf\` (\`organizationId\`), UNIQUE INDEX \`REL_b0d86990fe7160a5f3e4011fb2\` (\`productVariantId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_type_translation\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`languageCode\` varchar(255) NOT NULL, \`referenceId\` varchar(255) NOT NULL, INDEX \`IDX_e9dca49bad996f1761db3b2f56\` (\`isActive\`), INDEX \`IDX_65874d6bab7fefcaeccd2252c1\` (\`isArchived\`), INDEX \`IDX_30aafca59cdb456bf5231f9e46\` (\`tenantId\`), INDEX \`IDX_2dd271bdeb602b8c3956287e33\` (\`organizationId\`), INDEX \`IDX_f4b767c43b4e9130c63382c9b2\` (\`referenceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_type\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`icon\` varchar(255) NULL, INDEX \`IDX_90cc635a1065702ed3b79da6ec\` (\`isActive\`), INDEX \`IDX_49064ee0f3acd5882f4d893f3d\` (\`isArchived\`), INDEX \`IDX_f206c807fc7e41fc8a8b6679ae\` (\`tenantId\`), INDEX \`IDX_e4e4120b0c19d3a207ce38d758\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_variant_price\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`unitCost\` int NOT NULL DEFAULT '0', \`unitCostCurrency\` varchar(255) NOT NULL DEFAULT 'USD', \`retailPrice\` int NOT NULL DEFAULT '0', \`retailPriceCurrency\` varchar(255) NOT NULL DEFAULT 'USD', \`productVariantId\` varchar(36) NULL, INDEX \`IDX_562ef5984b6d4bed640bfcc6a2\` (\`isActive\`), INDEX \`IDX_24ac11e35221577e4ba4fdd229\` (\`isArchived\`), INDEX \`IDX_7052eaf00a5795afa5ebf35995\` (\`tenantId\`), INDEX \`IDX_0cfba32db58a952f58b1e35cf1\` (\`organizationId\`), UNIQUE INDEX \`REL_5842f603bd85d924127d63d73c\` (\`productVariantId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_variant\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`taxes\` int NOT NULL DEFAULT '0', \`notes\` varchar(255) NULL, \`quantity\` int NOT NULL DEFAULT '0', \`billingInvoicingPolicy\` varchar(255) NOT NULL DEFAULT 'Quantity ordered', \`internalReference\` varchar(255) NULL, \`enabled\` tinyint NOT NULL DEFAULT 1, \`productId\` varchar(255) NULL, \`imageId\` varchar(255) NULL, \`priceId\` varchar(36) NULL, \`settingId\` varchar(36) NULL, INDEX \`IDX_e0d896cadbc695a490f64bb7e7\` (\`isActive\`), INDEX \`IDX_e0005cbdabb760488f66f3fbba\` (\`isArchived\`), INDEX \`IDX_9121e00c4dc3500dc610cf8722\` (\`tenantId\`), INDEX \`IDX_6a289b10030ae86903406e3c9b\` (\`organizationId\`), INDEX \`IDX_6e420052844edf3a5506d863ce\` (\`productId\`), INDEX \`IDX_b83f23626741630a8629960715\` (\`imageId\`), UNIQUE INDEX \`REL_41b31a71dda350cfe5da07e0e4\` (\`priceId\`), UNIQUE INDEX \`REL_9f0fd369dfeb275415c649d110\` (\`settingId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`enabled\` tinyint NOT NULL DEFAULT 1, \`code\` varchar(255) NOT NULL, \`imageUrl\` varchar(255) NULL, \`featuredImageId\` varchar(255) NULL, \`productTypeId\` varchar(255) NULL, \`productCategoryId\` varchar(255) NULL, INDEX \`IDX_7bb2b2f7a4c8a4916d4339d7f4\` (\`isActive\`), INDEX \`IDX_6f58935aa2175d930e47e97c9f\` (\`isArchived\`), INDEX \`IDX_08293ca31a601d3cd0228120bc\` (\`tenantId\`), INDEX \`IDX_32a4bdd261ec81f4ca6b3abe26\` (\`organizationId\`), INDEX \`IDX_4627873dbc1af07d732e6eec7b\` (\`featuredImageId\`), INDEX \`IDX_374bfd0d1b0e1398d7206456d9\` (\`productTypeId\`), INDEX \`IDX_618194d24a7ea86a165d7ec628\` (\`productCategoryId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_translation\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`languageCode\` varchar(255) NOT NULL, \`referenceId\` varchar(255) NOT NULL, INDEX \`IDX_1d9ca23c7e1c606061fec8bb74\` (\`isActive\`), INDEX \`IDX_96413a8061ff4ccdc418d4e16a\` (\`isArchived\`), INDEX \`IDX_7533fd275bfb3219ce9eb4004c\` (\`tenantId\`), INDEX \`IDX_e6abcacc3d3a4f9cf5ca97f2b2\` (\`organizationId\`), INDEX \`IDX_d24bc28e54f1dc296452a25591\` (\`referenceId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`proposal\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`jobPostUrl\` varchar(255) NULL, \`valueDate\` datetime NULL, \`jobPostContent\` varchar(255) NOT NULL, \`proposalContent\` varchar(255) NOT NULL, \`status\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NULL, \`organizationContactId\` varchar(255) NULL, INDEX \`IDX_61a30a7d83666bf265fd86a72d\` (\`isActive\`), INDEX \`IDX_e2836e856f491dd4676e1ec8d3\` (\`isArchived\`), INDEX \`IDX_4177329f5e6ddbfb6416592713\` (\`tenantId\`), INDEX \`IDX_d59ec6899d435f430799795ad7\` (\`organizationId\`), INDEX \`IDX_cc28a54171231fbd9a127051f0\` (\`jobPostUrl\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`report_category\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`name\` varchar(255) NOT NULL, \`iconClass\` varchar(255) NULL, INDEX \`IDX_dd9fcd7916d0a22189ecea6a36\` (\`isActive\`), INDEX \`IDX_656f05f951faa13d7195853424\` (\`isArchived\`), INDEX \`IDX_fa278d337ba5e200d44ade6697\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`report_organization\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`reportId\` varchar(255) NOT NULL, \`isEnabled\` tinyint NOT NULL DEFAULT 1, INDEX \`IDX_a6bde8f44e18f17b1ca603e150\` (\`isActive\`), INDEX \`IDX_40459267d68604655aa6df4251\` (\`isArchived\`), INDEX \`IDX_edf9bd011d7f08e3e18a5becb8\` (\`tenantId\`), INDEX \`IDX_5193788a3ebc1143bedb74cf72\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`report\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`name\` varchar(255) NOT NULL, \`slug\` varchar(255) NULL, \`description\` varchar(255) NULL, \`image\` varchar(255) NULL, \`iconClass\` varchar(255) NULL, \`showInMenu\` tinyint NOT NULL DEFAULT 0, \`categoryId\` varchar(255) NOT NULL, INDEX \`IDX_143ead1a6ac5f73125d8c4c3aa\` (\`isActive\`), INDEX \`IDX_1316fdd7b9a2926437a13271bf\` (\`isArchived\`), INDEX \`IDX_6f9ee54eb839117e83b937648d\` (\`name\`), INDEX \`IDX_ef16fed5f7e6951027502e6458\` (\`slug\`), INDEX \`IDX_230652e48daa99c50c000fc5d1\` (\`categoryId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`request_approval_employee\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`status\` int NULL, \`requestApprovalId\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NOT NULL, INDEX \`IDX_2634ff04775e659c4792325f38\` (\`isActive\`), INDEX \`IDX_3d66190c19b9fe69a8bbb300df\` (\`isArchived\`), INDEX \`IDX_a5445b38b780b29b09369e36a9\` (\`tenantId\`), INDEX \`IDX_4071f027554eefff65ac8123e6\` (\`organizationId\`), INDEX \`IDX_563fec5539b89a57f40731f985\` (\`requestApprovalId\`), INDEX \`IDX_ce2113039f070b3f003aa0db61\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`request_approval_team\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`status\` int NULL, \`requestApprovalId\` varchar(255) NOT NULL, \`teamId\` varchar(255) NOT NULL, INDEX \`IDX_34b2e8f794e0336b9ac410d8bd\` (\`isActive\`), INDEX \`IDX_bdcb4ea389bdb794bae75b0170\` (\`isArchived\`), INDEX \`IDX_94b2a3d0f17c9549dea1493dc9\` (\`tenantId\`), INDEX \`IDX_77e1050669b32cfff482f96016\` (\`organizationId\`), INDEX \`IDX_6c75d8a8c609e88896b2653cc4\` (\`requestApprovalId\`), INDEX \`IDX_9ccdaee6c5c62cda8f7375e841\` (\`teamId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`request_approval\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`status\` int NULL, \`createdBy\` varchar(255) NULL, \`createdByName\` varchar(255) NULL, \`min_count\` int NULL, \`requestId\` varchar(255) NULL, \`requestType\` varchar(255) NULL, \`approvalPolicyId\` varchar(255) NULL, INDEX \`IDX_db152600f88a9a4888df0b626e\` (\`isActive\`), INDEX \`IDX_c77295d7f5d6086c815de3c120\` (\`isArchived\`), INDEX \`IDX_9feaa23ed7bc47d51315e304bb\` (\`tenantId\`), INDEX \`IDX_8343741e7929043b2a7de89f73\` (\`organizationId\`), INDEX \`IDX_c63fafc733ff8ab37dede8ffec\` (\`name\`), INDEX \`IDX_26bb3420001d31337393ed05bc\` (\`approvalPolicyId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`role_permission\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`permission\` varchar(255) NOT NULL, \`enabled\` tinyint NULL DEFAULT 0, \`description\` varchar(255) NULL, \`roleId\` varchar(255) NOT NULL, INDEX \`IDX_78f93dbb42a97f6785bcf53efd\` (\`isActive\`), INDEX \`IDX_5c36df1a5c85016952e90d760f\` (\`isArchived\`), INDEX \`IDX_cbd053921056e77c0a8e03122a\` (\`tenantId\`), INDEX \`IDX_8307c5c44a4ad6210b767b17a9\` (\`permission\`), INDEX \`IDX_e3130a39c1e4a740d044e68573\` (\`roleId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`role\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`isSystem\` tinyint NOT NULL DEFAULT 0, INDEX \`IDX_c5f75cd3367769b6f22b298d29\` (\`isActive\`), INDEX \`IDX_09868c0733ba37a4753ff8931f\` (\`isArchived\`), INDEX \`IDX_1751a572e91385a09d41c62471\` (\`tenantId\`), INDEX \`IDX_ae4578dcaed5adff96595e6166\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`skill\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`color\` varchar(255) NOT NULL, INDEX \`IDX_f4cdbe61d68413f4d6a671f8c2\` (\`isActive\`), INDEX \`IDX_ca52119f9e4857399706d723e9\` (\`isArchived\`), INDEX \`IDX_8e502eac7ed1347c71c26beae8\` (\`tenantId\`), INDEX \`IDX_b2923d394f3636671ff9b3c3e8\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`color\` varchar(255) NOT NULL, \`textColor\` varchar(255) NULL, \`description\` varchar(255) NULL, \`icon\` varchar(255) NULL, \`isSystem\` tinyint NOT NULL DEFAULT 0, \`organizationTeamId\` varchar(255) NULL, INDEX \`IDX_1f22c73374bcca1ea84a4dca59\` (\`isActive\`), INDEX \`IDX_58876ee26a90170551027459bf\` (\`isArchived\`), INDEX \`IDX_b08dd29fb6a8acdf83c83d8988\` (\`tenantId\`), INDEX \`IDX_c2f6bec0b39eaa3a6d90903ae9\` (\`organizationId\`), INDEX \`IDX_49746602acc4e5e8721062b69e\` (\`organizationTeamId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`task_estimation\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`estimate\` int NOT NULL, \`employeeId\` varchar(255) NOT NULL, \`taskId\` varchar(255) NOT NULL, INDEX \`IDX_b1a7086c279309b20e8384d0d9\` (\`isActive\`), INDEX \`IDX_1f3ffda4fce02682e76308b476\` (\`isArchived\`), INDEX \`IDX_87bfea6d0b9a1ec602ee88e5f6\` (\`tenantId\`), INDEX \`IDX_16507eb222e3c50be077fb4ace\` (\`organizationId\`), INDEX \`IDX_8f274646f2bdf4e12990feeb04\` (\`employeeId\`), INDEX \`IDX_a3ee022203211f678376cd919b\` (\`taskId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`issue_type\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`value\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`icon\` varchar(255) NULL, \`color\` varchar(255) NULL, \`isSystem\` tinyint NOT NULL DEFAULT 0, \`imageId\` varchar(255) NULL, \`projectId\` varchar(255) NULL, \`organizationTeamId\` varchar(255) NULL, INDEX \`IDX_722ce5d7535524b96c6d03f7c4\` (\`isActive\`), INDEX \`IDX_1909e9bae7d8b2c920b3e4d859\` (\`isArchived\`), INDEX \`IDX_8b12c913c39c72fe5980427c96\` (\`tenantId\`), INDEX \`IDX_16dbef9d1b2b422abdce8ee3ae\` (\`organizationId\`), INDEX \`IDX_4af451ab46a94e94394c72d911\` (\`name\`), INDEX \`IDX_af2d743ed61571bcdc5d9a27a0\` (\`value\`), INDEX \`IDX_33779b0395f72af0b50dc526d1\` (\`imageId\`), INDEX \`IDX_131331557078611a68b4a5b2e7\` (\`projectId\`), INDEX \`IDX_586513cceb16777fd14a17bfe1\` (\`organizationTeamId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`task\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`number\` bigint NULL, \`prefix\` varchar(255) NULL, \`title\` varchar(255) NOT NULL, \`description\` text NULL, \`status\` varchar(255) NULL, \`priority\` varchar(255) NULL, \`size\` varchar(255) NULL, \`issueType\` varchar(255) NULL, \`estimate\` int NULL, \`dueDate\` datetime NULL, \`public\` tinyint NULL DEFAULT 1, \`startDate\` datetime NULL, \`resolvedAt\` datetime NULL, \`version\` varchar(255) NULL, \`parentId\` varchar(255) NULL, \`projectId\` varchar(255) NULL, \`creatorId\` varchar(255) NULL, \`organizationSprintId\` varchar(255) NULL, \`taskStatusId\` varchar(255) NULL, \`taskSizeId\` varchar(255) NULL, \`taskPriorityId\` varchar(255) NULL, INDEX \`IDX_3e16c81005c389a4db83c0e5e3\` (\`isActive\`), INDEX \`IDX_ca2f7edd5a5ce8f14b257c9d54\` (\`isArchived\`), INDEX \`IDX_e91cbff3d206f150ccc14d0c3a\` (\`tenantId\`), INDEX \`IDX_5b0272d923a31c972bed1a1ac4\` (\`organizationId\`), INDEX \`IDX_2fe7a278e6f08d2be55740a939\` (\`status\`), INDEX \`IDX_f092f3386f10f2e2ef5b0b6ad1\` (\`priority\`), INDEX \`IDX_7127880d6fae956ecc1c84ac31\` (\`size\`), INDEX \`IDX_ed5441fb13e82854a994da5a78\` (\`issueType\`), INDEX \`IDX_3797a20ef5553ae87af126bc2f\` (\`projectId\`), INDEX \`IDX_94fe6b3a5aec5f85427df4f8cd\` (\`creatorId\`), INDEX \`IDX_1e1f64696aa3a26d3e12c840e5\` (\`organizationSprintId\`), INDEX \`IDX_0cbe714983eb0aae5feeee8212\` (\`taskStatusId\`), INDEX \`IDX_2f4bdd2593fd6038aaa91fd107\` (\`taskSizeId\`), INDEX \`IDX_b8616deefe44d0622233e73fbf\` (\`taskPriorityId\`), UNIQUE INDEX \`taskNumber\` (\`projectId\`, \`number\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`task_linked_issues\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`action\` int NOT NULL, \`taskFromId\` varchar(255) NOT NULL, \`taskToId\` varchar(255) NOT NULL, INDEX \`IDX_d49853e18e5bc772f5435b01a5\` (\`isActive\`), INDEX \`IDX_88021c0cd9508757d3d90333f8\` (\`isArchived\`), INDEX \`IDX_20b50abc5c97610a75d49ad381\` (\`tenantId\`), INDEX \`IDX_24114c4059e6b6991daba541b1\` (\`organizationId\`), INDEX \`IDX_6deea7b3671e45973e191a1502\` (\`taskFromId\`), INDEX \`IDX_0848fd2b8c23c0ab55146297cf\` (\`taskToId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`task_priority\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`value\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`icon\` varchar(255) NULL, \`color\` varchar(255) NULL, \`isSystem\` tinyint NOT NULL DEFAULT 0, \`projectId\` varchar(255) NULL, \`organizationTeamId\` varchar(255) NULL, INDEX \`IDX_8ddcc5eeaf96314f53ca486821\` (\`isActive\`), INDEX \`IDX_e6adb82db368af15f2b8cdd4e8\` (\`isArchived\`), INDEX \`IDX_1818655f27b8cf4f0d1dbfeb8d\` (\`tenantId\`), INDEX \`IDX_7fd1b30d159b608cbf59009f68\` (\`organizationId\`), INDEX \`IDX_7d656b4cba8f11e639dbc5aab3\` (\`name\`), INDEX \`IDX_46daede7b19176b6ad959d70da\` (\`value\`), INDEX \`IDX_db4237960ca989eb7a48cd433b\` (\`projectId\`), INDEX \`IDX_52b039cff6a1adf6b7f9e49ee4\` (\`organizationTeamId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`task_related_issue_type\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`value\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`icon\` varchar(255) NULL, \`color\` varchar(255) NULL, \`isSystem\` tinyint NOT NULL DEFAULT 0, \`projectId\` varchar(255) NULL, \`organizationTeamId\` varchar(255) NULL, INDEX \`IDX_5a341f51d8f5ec12db24ab033f\` (\`isActive\`), INDEX \`IDX_8177dd93be8044b37d3bb9285d\` (\`isArchived\`), INDEX \`IDX_b7b0ea8ac2825fb981c1181d11\` (\`tenantId\`), INDEX \`IDX_bed691e21fe01cf5aceee72295\` (\`organizationId\`), INDEX \`IDX_9423f99da972c150f85dbc11c1\` (\`name\`), INDEX \`IDX_61a7cb4452d9e23f91231b7fd6\` (\`value\`), INDEX \`IDX_d99fe5b50dbe5078e0d9a9b6a9\` (\`projectId\`), INDEX \`IDX_4967ebdca0aefb9d43e56695e4\` (\`organizationTeamId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`task_size\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`value\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`icon\` varchar(255) NULL, \`color\` varchar(255) NULL, \`isSystem\` tinyint NOT NULL DEFAULT 0, \`projectId\` varchar(255) NULL, \`organizationTeamId\` varchar(255) NULL, INDEX \`IDX_d65afcfe2d64e49d43931579a3\` (\`isActive\`), INDEX \`IDX_8f26ffc61abaef417b0f807695\` (\`isArchived\`), INDEX \`IDX_f6ec2207e50680a475d71c8979\` (\`tenantId\`), INDEX \`IDX_596512cc6508a482cc23ae6ab7\` (\`organizationId\`), INDEX \`IDX_90c54f57b29cc8b67edc2738ae\` (\`name\`), INDEX \`IDX_1a7b137d009616a2ff1aa6834f\` (\`value\`), INDEX \`IDX_ad6792b26526bd96ab18d63454\` (\`projectId\`), INDEX \`IDX_f4438327b3c2afb0832569b2a1\` (\`organizationTeamId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`task_status\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`value\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`order\` int NULL, \`icon\` varchar(255) NULL, \`color\` varchar(255) NULL, \`isSystem\` tinyint NOT NULL DEFAULT 0, \`isCollapsed\` tinyint NOT NULL DEFAULT 0, \`projectId\` varchar(255) NULL, \`organizationTeamId\` varchar(255) NULL, INDEX \`IDX_25d9737ee153411871b4d20c67\` (\`isActive\`), INDEX \`IDX_79c525a8c2209e90186bfcbea9\` (\`isArchived\`), INDEX \`IDX_efbaf00a743316b394cc31e4a2\` (\`tenantId\`), INDEX \`IDX_9b9a828a49f4bd6383a4073fe2\` (\`organizationId\`), INDEX \`IDX_b0c955f276679dd2b2735c3936\` (\`name\`), INDEX \`IDX_68eaba689ed6d3e27ec93d3e88\` (\`value\`), INDEX \`IDX_a19e8975e5c296640d457dfc11\` (\`projectId\`), INDEX \`IDX_0330b4a942b536d8d1f264abe3\` (\`organizationTeamId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`task_version\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`value\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`icon\` varchar(255) NULL, \`color\` varchar(255) NULL, \`isSystem\` tinyint NOT NULL DEFAULT 0, \`projectId\` varchar(255) NULL, \`organizationTeamId\` varchar(255) NULL, INDEX \`IDX_7e509a66367ecaf8e3bc96f263\` (\`isActive\`), INDEX \`IDX_313b0e55871c1c9b6c22341536\` (\`isArchived\`), INDEX \`IDX_379c8bd0ce203341148c1f99ee\` (\`tenantId\`), INDEX \`IDX_9c845f353378371ee3aa60f686\` (\`organizationId\`), INDEX \`IDX_3396dda57286ca17ab61fd3704\` (\`name\`), INDEX \`IDX_e9fd8df772ad2d955a65f4c68a\` (\`value\`), INDEX \`IDX_91988120385964f213aec8aa84\` (\`projectId\`), INDEX \`IDX_959e77718a2e76ee56498c1106\` (\`organizationTeamId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tenant_setting\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`value\` varchar(255) NULL, INDEX \`IDX_1d9975b98d82f385ae14b4d7c6\` (\`isActive\`), INDEX \`IDX_a7500f9b1b7917bf10882c820e\` (\`isArchived\`), INDEX \`IDX_affdab301e348b892175f30fa3\` (\`tenantId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tenant\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`name\` varchar(255) NOT NULL, \`logo\` varchar(255) NULL, \`imageId\` varchar(255) NULL, INDEX \`IDX_b8eb9f3e420aa846f30e291960\` (\`isActive\`), INDEX \`IDX_eeedffab85b3534a1068d9270f\` (\`isArchived\`), INDEX \`IDX_56211336b5ff35fd944f225917\` (\`name\`), INDEX \`IDX_d154d06dac0d0e0a5d9a083e25\` (\`imageId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`time_off_policy\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`requiresApproval\` tinyint NOT NULL, \`paid\` tinyint NOT NULL, INDEX \`IDX_cf9377d3bcb7cb996f72268941\` (\`isActive\`), INDEX \`IDX_22d919e53cf5f6d836b18d407a\` (\`isArchived\`), INDEX \`IDX_1c0ed84d54f8fbe4af10dfcda1\` (\`tenantId\`), INDEX \`IDX_c2744cffeca55c3c9c52bb9789\` (\`organizationId\`), INDEX \`IDX_7d7f69c79df4a6f152b0e362b1\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`time_off_request\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`documentUrl\` varchar(255) NULL, \`description\` varchar(255) NULL, \`start\` datetime NOT NULL, \`end\` datetime NOT NULL, \`requestDate\` datetime NOT NULL, \`status\` varchar(255) NOT NULL, \`isHoliday\` tinyint NULL DEFAULT 0, \`policyId\` varchar(255) NOT NULL, \`documentId\` varchar(255) NULL, INDEX \`IDX_45e4bc4476681f4db2097cc2d5\` (\`isActive\`), INDEX \`IDX_5ddef92c4694e6d650d9e557b3\` (\`isArchived\`), INDEX \`IDX_4989834dd1c9c8ea3576ed99ce\` (\`tenantId\`), INDEX \`IDX_981333982a6df8b815957dcbf2\` (\`organizationId\`), INDEX \`IDX_c1f8ae47dc2f1882afc5045c73\` (\`policyId\`), INDEX \`IDX_c009cdd795be674c2047062374\` (\`documentId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`activity\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`title\` varchar(255) NULL, \`description\` longtext NULL, \`metaData\` json NULL, \`date\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`time\` time(6) NOT NULL DEFAULT '0', \`duration\` int NOT NULL DEFAULT '0', \`type\` varchar(255) NULL, \`source\` varchar(255) NOT NULL DEFAULT 'BROWSER', \`recordedAt\` datetime NULL, \`employeeId\` varchar(255) NOT NULL, \`projectId\` varchar(255) NULL, \`timeSlotId\` varchar(255) NULL, \`taskId\` varchar(255) NULL, INDEX \`IDX_ae6ac57aafef59f561d4db3dd7\` (\`isActive\`), INDEX \`IDX_d2d6db7f03da5632687e5d140e\` (\`isArchived\`), INDEX \`IDX_f2401d8fdff5d8970dfe30d3ae\` (\`tenantId\`), INDEX \`IDX_fdb3f018c2bba4885bfa5757d1\` (\`organizationId\`), INDEX \`IDX_a28a1682ea80f10d1ecc7babaa\` (\`title\`), INDEX \`IDX_302b60a4970ffe94d5223f1c23\` (\`date\`), INDEX \`IDX_b5525385e85f7429e233d4a0fa\` (\`time\`), INDEX \`IDX_f27285af15ef48363745ab2d79\` (\`type\`), INDEX \`IDX_0e36a2c95e2f1df7f1b3059d24\` (\`source\`), INDEX \`IDX_ffd736f18ba71b3221e4f835a9\` (\`recordedAt\`), INDEX \`IDX_a6f74ae99d549932391f0f4460\` (\`employeeId\`), INDEX \`IDX_5a898f44fa31ef7916f0c38b01\` (\`projectId\`), INDEX \`IDX_4e382caaf07ab0923b2e06bf91\` (\`timeSlotId\`), INDEX \`IDX_2743f8990fde12f9586287eb09\` (\`taskId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`screenshot\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`file\` varchar(255) NOT NULL, \`thumb\` varchar(255) NULL, \`recordedAt\` datetime NULL, \`storageProvider\` enum ('LOCAL', 'S3', 'WASABI', 'CLOUDINARY') NULL, \`isWorkRelated\` tinyint NULL, \`description\` varchar(255) NULL, \`apps\` json NULL, \`timeSlotId\` varchar(255) NULL, \`userId\` varchar(255) NULL, INDEX \`IDX_742688858e0484d66f04e4d4c4\` (\`isActive\`), INDEX \`IDX_892e285e1da2b3e61e51e50628\` (\`isArchived\`), INDEX \`IDX_235004f3dafac90692cd64d915\` (\`tenantId\`), INDEX \`IDX_0951aacffe3f8d0cff54cf2f34\` (\`organizationId\`), INDEX \`IDX_3d7feb5fe793e4811cdb79f983\` (\`recordedAt\`), INDEX \`IDX_2b374e5cdee1145ebb2a832f20\` (\`storageProvider\`), INDEX \`IDX_1b0867d86ead2332f3d4edba7d\` (\`isWorkRelated\`), INDEX \`IDX_eea7986acfb827bf5d0622c41f\` (\`description\`), INDEX \`IDX_5b594d02d98d5defcde323abe5\` (\`timeSlotId\`), INDEX \`IDX_fa1896dc735403799311968f7e\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`time_log\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`startedAt\` datetime NULL, \`stoppedAt\` datetime NULL, \`editedAt\` datetime NULL, \`logType\` varchar(255) NOT NULL DEFAULT 'TRACKED', \`source\` varchar(255) NOT NULL DEFAULT 'BROWSER', \`description\` longtext NULL, \`reason\` varchar(255) NULL, \`isBillable\` tinyint NOT NULL DEFAULT 0, \`isRunning\` tinyint NULL, \`version\` varchar(255) NULL, \`employeeId\` varchar(255) NOT NULL, \`timesheetId\` varchar(255) NULL, \`projectId\` varchar(255) NULL, \`taskId\` varchar(255) NULL, \`organizationContactId\` varchar(255) NULL, \`organizationTeamId\` varchar(255) NULL, INDEX \`IDX_a1910a76044b971609b75ea165\` (\`isActive\`), INDEX \`IDX_91a64228fbbe1516730a0cab5d\` (\`isArchived\`), INDEX \`IDX_fa9018cb248ea0f3b2b30ef143\` (\`tenantId\`), INDEX \`IDX_aed2d5cc5680fba9d387c7f931\` (\`organizationId\`), INDEX \`IDX_189b79acd611870aba62b3594e\` (\`startedAt\`), INDEX \`IDX_a1f8fcd70164d915fe7dd4a1ec\` (\`stoppedAt\`), INDEX \`IDX_154e9120e2acb632d8bd9b91ff\` (\`editedAt\`), INDEX \`IDX_e80fb588b1086ce2a4f2244814\` (\`logType\`), INDEX \`IDX_402290e7045e0c10ef97d9f982\` (\`source\`), INDEX \`IDX_722b9cb3a991c964d86396b6bc\` (\`isBillable\`), INDEX \`IDX_f447474d185cd70b3015853874\` (\`isRunning\`), INDEX \`IDX_79001d281ecb766005b3d331c1\` (\`version\`), INDEX \`IDX_a89a849957e005bafb8e4220bc\` (\`employeeId\`), INDEX \`IDX_e65393bb52aa8275b1392c73f7\` (\`timesheetId\`), INDEX \`IDX_54776f6f5fd3c13c3bc1fbfac5\` (\`projectId\`), INDEX \`IDX_1ddf2da35e34378fd845d80a18\` (\`taskId\`), INDEX \`IDX_d1e8f22c02c5e949453dde7f2d\` (\`organizationContactId\`), INDEX \`IDX_18dcdf754396f0cb0308dc91f4\` (\`organizationTeamId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`time_slot\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`duration\` int NOT NULL DEFAULT '0', \`keyboard\` int NOT NULL DEFAULT '0', \`mouse\` int NOT NULL DEFAULT '0', \`overall\` int NOT NULL DEFAULT '0', \`startedAt\` datetime NOT NULL, \`employeeId\` varchar(255) NOT NULL, INDEX \`IDX_645a6bc3f1141d4a111a3166d8\` (\`isActive\`), INDEX \`IDX_81060c5dbe69efa1f3b6e1a2e5\` (\`isArchived\`), INDEX \`IDX_b8284109257b5137256b5b3e84\` (\`tenantId\`), INDEX \`IDX_b407841271245501dd1a8c7551\` (\`organizationId\`), INDEX \`IDX_0c707825a7c2ecc4e186b07ebf\` (\`duration\`), INDEX \`IDX_f44e721669d5c6bed32cd6a3bf\` (\`overall\`), INDEX \`IDX_c6e7d1075bfd97eea6643b1479\` (\`startedAt\`), INDEX \`IDX_7913305b850c7afc89b6ed96a3\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`time_slot_minute\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`keyboard\` int NOT NULL DEFAULT '0', \`mouse\` int NOT NULL DEFAULT '0', \`datetime\` datetime NOT NULL, \`timeSlotId\` varchar(255) NOT NULL, INDEX \`IDX_8260fdc7862ca27d8cf10e6290\` (\`isActive\`), INDEX \`IDX_a3eeb9629f550c367bb752855e\` (\`isArchived\`), INDEX \`IDX_c7f72cb68b22b8ab988158e4d2\` (\`tenantId\`), INDEX \`IDX_82c5edbd179359212f16f0d386\` (\`organizationId\`), INDEX \`IDX_9272701d3da8bd8507f316c915\` (\`timeSlotId\`), UNIQUE INDEX \`IDX_0ac1d2777eefcee82db52ca366\` (\`timeSlotId\`, \`datetime\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`timesheet\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`duration\` int NOT NULL DEFAULT '0', \`keyboard\` int NOT NULL DEFAULT '0', \`mouse\` int NOT NULL DEFAULT '0', \`overall\` int NOT NULL DEFAULT '0', \`startedAt\` datetime NULL, \`stoppedAt\` datetime NULL, \`approvedAt\` datetime NULL, \`submittedAt\` datetime NULL, \`lockedAt\` datetime NULL, \`editedAt\` datetime NULL, \`isBilled\` tinyint NOT NULL DEFAULT 0, \`status\` varchar(255) NOT NULL DEFAULT 'PENDING', \`employeeId\` varchar(255) NOT NULL, \`approvedById\` varchar(255) NULL, INDEX \`IDX_42205a9e6af108364e5cc62dd4\` (\`isActive\`), INDEX \`IDX_f2d4cd3a7e839bfc7cb6b993ff\` (\`isArchived\`), INDEX \`IDX_25b8df69c9b7f5752c6a6a6ef7\` (\`tenantId\`), INDEX \`IDX_aca65a79fe0c1ec9e6a59022c5\` (\`organizationId\`), INDEX \`IDX_930e2b28de9ecb1ea689d5a97a\` (\`startedAt\`), INDEX \`IDX_f6558fbb3158ab90da1c41d943\` (\`stoppedAt\`), INDEX \`IDX_6a79eb7534066b11f59243ede1\` (\`approvedAt\`), INDEX \`IDX_3f8fc4b5718fcaa913f9438e27\` (\`submittedAt\`), INDEX \`IDX_3502c60f98a7cda58dea75bcb5\` (\`lockedAt\`), INDEX \`IDX_ea81b5247ecdf5d82cf71fa096\` (\`editedAt\`), INDEX \`IDX_c828facbb4250117f83416d9f7\` (\`isBilled\`), INDEX \`IDX_23fdffa8369387d87101090684\` (\`status\`), INDEX \`IDX_8c8f821cb0fe0dd387491ea7d9\` (\`employeeId\`), INDEX \`IDX_6c1f81934a3f597b3b1a17f562\` (\`approvedById\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`user_organization\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`isDefault\` tinyint NOT NULL DEFAULT 1, \`userId\` varchar(255) NOT NULL, INDEX \`IDX_ca24fc59aac015d9660955f5f6\` (\`isActive\`), INDEX \`IDX_c764336019c69cc4927f317cb0\` (\`isArchived\`), INDEX \`IDX_611e1392c8cc9b101e3ea7ad80\` (\`tenantId\`), INDEX \`IDX_7143f31467178a6164a42426c1\` (\`organizationId\`), INDEX \`IDX_1f97ff07fb198bd0a7786b2abd\` (\`isDefault\`), INDEX \`IDX_29c3c8cc3ea9db22e4a347f4b5\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`user\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`thirdPartyId\` varchar(255) NULL, \`firstName\` varchar(255) NULL, \`lastName\` varchar(255) NULL, \`email\` varchar(255) NULL, \`phoneNumber\` varchar(255) NULL, \`username\` varchar(255) NULL, \`timeZone\` varchar(255) NULL, \`hash\` varchar(255) NULL, \`refreshToken\` varchar(255) NULL, \`imageUrl\` varchar(500) NULL, \`preferredLanguage\` varchar(255) NULL DEFAULT 'en', \`preferredComponentLayout\` enum ('CARDS_GRID', 'TABLE') NULL DEFAULT 'TABLE', \`code\` varchar(255) NULL, \`codeExpireAt\` datetime NULL, \`emailVerifiedAt\` datetime NULL, \`emailToken\` varchar(255) NULL, \`roleId\` varchar(255) NULL, \`imageId\` varchar(255) NULL, INDEX \`IDX_fde2ce12ab12b02ae583dd76c7\` (\`isActive\`), INDEX \`IDX_557cb712d32a9ad9ffbb4cd50d\` (\`isArchived\`), INDEX \`IDX_685bf353c85f23b6f848e4dcde\` (\`tenantId\`), INDEX \`IDX_19de43e9f1842360ce646253d7\` (\`thirdPartyId\`), INDEX \`IDX_58e4dbff0e1a32a9bdc861bb29\` (\`firstName\`), INDEX \`IDX_f0e1b4ecdca13b177e2e3a0613\` (\`lastName\`), INDEX \`IDX_e12875dfb3b1d92d7d7c5377e2\` (\`email\`), INDEX \`IDX_f2578043e491921209f5dadd08\` (\`phoneNumber\`), INDEX \`IDX_78a916df40e02a9deb1c4b75ed\` (\`username\`), INDEX \`IDX_c28e52f758e7bbc53828db9219\` (\`roleId\`), INDEX \`IDX_5e028298e103e1694147ada69e\` (\`imageId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`warehouse_product\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`quantity\` decimal NULL DEFAULT '0', \`warehouseId\` varchar(255) NOT NULL, \`productId\` varchar(255) NOT NULL, INDEX \`IDX_7a584a02d15a022e9c4f06ea72\` (\`isActive\`), INDEX \`IDX_3370818c940a51996d80bb4d16\` (\`isArchived\`), INDEX \`IDX_62573a939f834f2de343f98288\` (\`tenantId\`), INDEX \`IDX_c899e17322d11e1977832e8c65\` (\`organizationId\`), INDEX \`IDX_a8c9aee14d47ec7b3f2ac429eb\` (\`warehouseId\`), INDEX \`IDX_3f934c4772e7c7f2c66d7ea4e7\` (\`productId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`warehouse_product_variant\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`quantity\` decimal NULL DEFAULT '0', \`variantId\` varchar(255) NOT NULL, \`warehouseProductId\` varchar(255) NOT NULL, INDEX \`IDX_5f32a52e9bd19bf323b02efcd1\` (\`isActive\`), INDEX \`IDX_40aa52eaed1ce133f5fee76bca\` (\`isArchived\`), INDEX \`IDX_a1c4a97b928b547c3041d3ac1f\` (\`tenantId\`), INDEX \`IDX_d5f4b64e6a80546fd6dd4ac3ed\` (\`organizationId\`), INDEX \`IDX_a2f863689d1316810c41c1ea38\` (\`variantId\`), INDEX \`IDX_617306cb3613dd8d59301ae16f\` (\`warehouseProductId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`warehouse\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`code\` varchar(255) NOT NULL, \`email\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`active\` tinyint NOT NULL DEFAULT 1, \`logoId\` varchar(255) NULL, \`contactId\` varchar(255) NULL, INDEX \`IDX_ee85901ae866ffe2061d5b35c8\` (\`isActive\`), INDEX \`IDX_835691d3dd62d0b705302cbb2d\` (\`isArchived\`), INDEX \`IDX_9b2f00761a6b1b77cb6289e3ff\` (\`tenantId\`), INDEX \`IDX_f5735eafddabdb4b20f621a976\` (\`organizationId\`), INDEX \`IDX_f502dc6d9802306f9d1584932b\` (\`logoId\`), INDEX \`IDX_84594016a98da8b87e0f51cd93\` (\`contactId\`), UNIQUE INDEX \`REL_84594016a98da8b87e0f51cd93\` (\`contactId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`knowledge_base\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`flag\` varchar(255) NOT NULL, \`icon\` varchar(255) NOT NULL, \`privacy\` varchar(255) NOT NULL, \`language\` varchar(255) NOT NULL, \`color\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`data\` varchar(255) NULL, \`index\` int NULL, \`parentId\` varchar(255) NULL, INDEX \`IDX_9b22423b8cb20087c16613ecba\` (\`isActive\`), INDEX \`IDX_0765098c5a6f93f51a55bda026\` (\`isArchived\`), INDEX \`IDX_bcb30c9893f4c8d0c4e556b4ed\` (\`tenantId\`), INDEX \`IDX_2ba72a9dec732a10e8c05bcdec\` (\`organizationId\`), INDEX \`IDX_ff979040ce93cbc60863d322ec\` (\`parentId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`knowledge_base_article\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`data\` varchar(255) NULL, \`draft\` tinyint NOT NULL, \`privacy\` tinyint NOT NULL, \`index\` int NOT NULL, \`categoryId\` varchar(255) NOT NULL, INDEX \`IDX_1544c43e36e1ccf7d578c70607\` (\`isActive\`), INDEX \`IDX_e9720156c57ff1ad841e95ace7\` (\`isArchived\`), INDEX \`IDX_06a9902fedc1f9dcdbaf14afb0\` (\`tenantId\`), INDEX \`IDX_3547f82f867489542ceae58a49\` (\`organizationId\`), INDEX \`IDX_66af194845635058239e794e1b\` (\`categoryId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`knowledge_base_author\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`employeeId\` varchar(255) NOT NULL, \`articleId\` varchar(255) NOT NULL, INDEX \`IDX_b9623984c84eb7be4c0eb076c2\` (\`isActive\`), INDEX \`IDX_a9130ad7824fb843f06103971e\` (\`isArchived\`), INDEX \`IDX_1551e821871d9230cc0dafbbe5\` (\`tenantId\`), INDEX \`IDX_81558bb2bef673628d92540b4e\` (\`organizationId\`), INDEX \`IDX_8eb7e413257d7a26104f4e326f\` (\`employeeId\`), INDEX \`IDX_2d5ecab1f06b327bad54553614\` (\`articleId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`changelog\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`icon\` varchar(255) NULL, \`title\` varchar(255) NULL, \`date\` datetime NOT NULL, \`content\` varchar(255) NOT NULL, \`isFeature\` tinyint NULL, \`learnMoreUrl\` varchar(255) NULL, \`imageUrl\` varchar(255) NULL, INDEX \`IDX_cc89233c87fcf64b01df07e038\` (\`isActive\`), INDEX \`IDX_cbc2b8338d45e774afd8682ffe\` (\`isArchived\`), INDEX \`IDX_744268ee0ec6073883267bc3b6\` (\`tenantId\`), INDEX \`IDX_c2037b621d2e8023898aee4ac7\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_candidate\` (\`candidateId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_34e4625cc9b010079f1b5758b3\` (\`candidateId\`), INDEX \`IDX_7e0891bb331b08bd4abb6776b7\` (\`tagId\`), PRIMARY KEY (\`candidateId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`employee_job_preset\` (\`jobPresetId\` varchar(36) NOT NULL, \`employeeId\` varchar(36) NOT NULL, INDEX \`IDX_7ae5b4d4bdec77971dab319f2e\` (\`jobPresetId\`), INDEX \`IDX_68e75e49f06409fd385b4f8774\` (\`employeeId\`), PRIMARY KEY (\`jobPresetId\`, \`employeeId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_employee_level\` (\`employeeLevelId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_b3565ff8073d4f66c46d27fe88\` (\`employeeLevelId\`), INDEX \`IDX_f3caf4cc158fe8b8e06578e792\` (\`tagId\`), PRIMARY KEY (\`employeeLevelId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_project_employee\` (\`employeeId\` varchar(36) NOT NULL, \`organizationProjectId\` varchar(36) NOT NULL, INDEX \`IDX_6b5b0c3d994f59d9c800922257\` (\`employeeId\`), INDEX \`IDX_2ba868f42c2301075b7c141359\` (\`organizationProjectId\`), PRIMARY KEY (\`employeeId\`, \`organizationProjectId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_employee\` (\`employeeId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_e0ddfccfe9816681c410ebf2b9\` (\`employeeId\`), INDEX \`IDX_b1ffe2a63a48b486e18dc59d1b\` (\`tagId\`), PRIMARY KEY (\`employeeId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`time_off_policy_employee\` (\`employeeId\` varchar(36) NOT NULL, \`timeOffPolicyId\` varchar(36) NOT NULL, INDEX \`IDX_c451f53f5a6cd97db94e1c9482\` (\`employeeId\`), INDEX \`IDX_0f823750ac5a7d899cc5d8d040\` (\`timeOffPolicyId\`), PRIMARY KEY (\`employeeId\`, \`timeOffPolicyId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`time_off_request_employee\` (\`employeeId\` varchar(36) NOT NULL, \`timeOffRequestId\` varchar(36) NOT NULL, INDEX \`IDX_cd312469204347b1210397770a\` (\`employeeId\`), INDEX \`IDX_0a8cf0aacf95ce66e73e75a95c\` (\`timeOffRequestId\`), PRIMARY KEY (\`employeeId\`, \`timeOffRequestId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`employee_tasks_task\` (\`employeeId\` varchar(36) NOT NULL, \`taskId\` varchar(36) NOT NULL, INDEX \`IDX_eae5eea1c6a3fcf4a2c95f1a5f\` (\`employeeId\`), INDEX \`IDX_6bbbe677c5fc5115916b4eccfb\` (\`taskId\`), PRIMARY KEY (\`employeeId\`, \`taskId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`equipment_shares_employees\` (\`equipmentSharingId\` varchar(36) NOT NULL, \`employeeId\` varchar(36) NOT NULL, INDEX \`IDX_8676224f55a965c53e4bb7cbf8\` (\`equipmentSharingId\`), INDEX \`IDX_57f6461f1a710f0f4abdcb8d0e\` (\`employeeId\`), PRIMARY KEY (\`equipmentSharingId\`, \`employeeId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`equipment_shares_teams\` (\`equipmentSharingId\` varchar(36) NOT NULL, \`organizationTeamId\` varchar(36) NOT NULL, INDEX \`IDX_f84171695b7aedfc454483bcf2\` (\`equipmentSharingId\`), INDEX \`IDX_7ccef49dd56c8c74daa8d12186\` (\`organizationTeamId\`), PRIMARY KEY (\`equipmentSharingId\`, \`organizationTeamId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_equipment\` (\`equipmentId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_bb0062d51a75164fcb64041ee7\` (\`equipmentId\`), INDEX \`IDX_0360b8197c2a38d6fe882cb1af\` (\`tagId\`), PRIMARY KEY (\`equipmentId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_event_type\` (\`eventTypeId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_094af399a26d4a1d3ae17ea11e\` (\`eventTypeId\`), INDEX \`IDX_34b8f471aac00eaec6f2830e5b\` (\`tagId\`), PRIMARY KEY (\`eventTypeId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_organization_expense_category\` (\`expenseCategoryId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_107a93f89c8f31f4386ae4b19d\` (\`expenseCategoryId\`), INDEX \`IDX_727dbf5e1100023681e216d6a9\` (\`tagId\`), PRIMARY KEY (\`expenseCategoryId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_expense\` (\`expenseId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_6f1108552ea7a70a4d958b338c\` (\`expenseId\`), INDEX \`IDX_8dcfbd0d960672fefe681bcba9\` (\`tagId\`), PRIMARY KEY (\`expenseId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_income\` (\`incomeId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_55c9568ebe1c4addc3deb6922e\` (\`incomeId\`), INDEX \`IDX_00e2fd30761a36911648166044\` (\`tagId\`), PRIMARY KEY (\`incomeId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`integration_integration_type\` (\`integrationId\` varchar(36) NOT NULL, \`integrationTypeId\` varchar(36) NOT NULL, INDEX \`IDX_34c86921ee9b462bc5c7b61fad\` (\`integrationId\`), INDEX \`IDX_8dd2062499a6c2a708ddd05650\` (\`integrationTypeId\`), PRIMARY KEY (\`integrationId\`, \`integrationTypeId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_integration\` (\`integrationId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_c9a85b16615bc5c3035802adb0\` (\`integrationId\`), INDEX \`IDX_0f19ad9872190b7a67a9652d5e\` (\`tagId\`), PRIMARY KEY (\`integrationId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`invite_organization_project\` (\`inviteId\` varchar(36) NOT NULL, \`organizationProjectId\` varchar(36) NOT NULL, INDEX \`IDX_020325728f0979a2822a829565\` (\`inviteId\`), INDEX \`IDX_f2806968dd846cb49fcdac195a\` (\`organizationProjectId\`), PRIMARY KEY (\`inviteId\`, \`organizationProjectId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`invite_organization_contact\` (\`inviteId\` varchar(36) NOT NULL, \`organizationContactId\` varchar(36) NOT NULL, INDEX \`IDX_a0c92b6393c7a13266003d552e\` (\`inviteId\`), INDEX \`IDX_c5a147ce2a0ec69ccc61149262\` (\`organizationContactId\`), PRIMARY KEY (\`inviteId\`, \`organizationContactId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`invite_organization_department\` (\`inviteId\` varchar(36) NOT NULL, \`organizationDepartmentId\` varchar(36) NOT NULL, INDEX \`IDX_0935b93b3498a0f98db1af7176\` (\`inviteId\`), INDEX \`IDX_fe2eea7a939442efde885303ef\` (\`organizationDepartmentId\`), PRIMARY KEY (\`inviteId\`, \`organizationDepartmentId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`invite_organization_team\` (\`inviteId\` varchar(36) NOT NULL, \`organizationTeamId\` varchar(36) NOT NULL, INDEX \`IDX_104140c94e838a058a34b30a09\` (\`inviteId\`), INDEX \`IDX_1132ec0c3618e53fc8cf7ed669\` (\`organizationTeamId\`), PRIMARY KEY (\`inviteId\`, \`organizationTeamId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_invoice\` (\`invoiceId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_5a07958d7c6253b311dbdc34ff\` (\`invoiceId\`), INDEX \`IDX_0728fc2cc26e8802cbf41aaf27\` (\`tagId\`), PRIMARY KEY (\`invoiceId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_merchant\` (\`merchantId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_e7d60a4e9906d056a8966e279f\` (\`merchantId\`), INDEX \`IDX_4af822b453c7d7d5f033e6ea16\` (\`tagId\`), PRIMARY KEY (\`merchantId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`warehouse_merchant\` (\`merchantId\` varchar(36) NOT NULL, \`warehouseId\` varchar(36) NOT NULL, INDEX \`IDX_812f0cfb560ac6dda0d1345765\` (\`merchantId\`), INDEX \`IDX_a6bfc0dc6e5234e8e7ef698a36\` (\`warehouseId\`), PRIMARY KEY (\`merchantId\`, \`warehouseId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_organization_contact\` (\`organizationContactId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_1fb664a63f20bea6a3f0b38771\` (\`organizationContactId\`), INDEX \`IDX_8a06f5aded97d1b5e81005e121\` (\`tagId\`), PRIMARY KEY (\`organizationContactId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_contact_employee\` (\`organizationContactId\` varchar(36) NOT NULL, \`employeeId\` varchar(36) NOT NULL, INDEX \`IDX_beffeb7f338fa98354948c0789\` (\`organizationContactId\`), INDEX \`IDX_cd2bd8302bfb6093d0908c36dc\` (\`employeeId\`), PRIMARY KEY (\`organizationContactId\`, \`employeeId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_organization_department\` (\`organizationDepartmentId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_c2c9cd2ea533d5442de455fb3e\` (\`organizationDepartmentId\`), INDEX \`IDX_0eb285a6b1ac7e3d0a542e50a4\` (\`tagId\`), PRIMARY KEY (\`organizationDepartmentId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_department_employee\` (\`organizationDepartmentId\` varchar(36) NOT NULL, \`employeeId\` varchar(36) NOT NULL, INDEX \`IDX_c34e79a3aa682bbd3f0e8cf4c4\` (\`organizationDepartmentId\`), INDEX \`IDX_0d4f83695591ae3c98a0544ac8\` (\`employeeId\`), PRIMARY KEY (\`organizationDepartmentId\`, \`employeeId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate_department\` (\`organizationDepartmentId\` varchar(36) NOT NULL, \`candidateId\` varchar(36) NOT NULL, INDEX \`IDX_c58533f9ba63f42fef682e1ee7\` (\`organizationDepartmentId\`), INDEX \`IDX_ef6e8d34b95dcb2b21d5de08a6\` (\`candidateId\`), PRIMARY KEY (\`organizationDepartmentId\`, \`candidateId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_organization_employment_type\` (\`organizationEmploymentTypeId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_41a87d3cfa58c851bbf03ad4e8\` (\`organizationEmploymentTypeId\`), INDEX \`IDX_904a731b2ae6bc1aa52c8302a9\` (\`tagId\`), PRIMARY KEY (\`organizationEmploymentTypeId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_employment_type_employee\` (\`organizationEmploymentTypeId\` varchar(36) NOT NULL, \`employeeId\` varchar(36) NOT NULL, INDEX \`IDX_3bfdb894d67e6a29aa95780bb4\` (\`organizationEmploymentTypeId\`), INDEX \`IDX_3ed17d3e624435e9f2ad71e058\` (\`employeeId\`), PRIMARY KEY (\`organizationEmploymentTypeId\`, \`employeeId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`candidate_employment_type\` (\`organizationEmploymentTypeId\` varchar(36) NOT NULL, \`candidateId\` varchar(36) NOT NULL, INDEX \`IDX_b4b51067c538f78b8585ef2a17\` (\`organizationEmploymentTypeId\`), INDEX \`IDX_8c5db3a96baffba025729ebe86\` (\`candidateId\`), PRIMARY KEY (\`organizationEmploymentTypeId\`, \`candidateId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_organization_position\` (\`organizationPositionId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_1f7e0230bc542d703781020378\` (\`organizationPositionId\`), INDEX \`IDX_c71c381e77b0543ed4023aeef7\` (\`tagId\`), PRIMARY KEY (\`organizationPositionId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_organization_project\` (\`organizationProjectId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_b69fa5d1b1d02cdbe301ea6b10\` (\`organizationProjectId\`), INDEX \`IDX_18be859b371e9159dfc2cecbe1\` (\`tagId\`), PRIMARY KEY (\`organizationProjectId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_project_team\` (\`organizationProjectId\` varchar(36) NOT NULL, \`organizationTeamId\` varchar(36) NOT NULL, INDEX \`IDX_7c31431ff2173c2c939a0aa036\` (\`organizationProjectId\`), INDEX \`IDX_599a5f7f6c190822dcfdbbb6eb\` (\`organizationTeamId\`), PRIMARY KEY (\`organizationProjectId\`, \`organizationTeamId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_organization_team\` (\`organizationTeamId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_4b5e0ca086e6124eeddf84252f\` (\`organizationTeamId\`), INDEX \`IDX_2382356b63c832a137079210bd\` (\`tagId\`), PRIMARY KEY (\`organizationTeamId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`organization_team_tasks_task\` (\`organizationTeamId\` varchar(36) NOT NULL, \`taskId\` varchar(36) NOT NULL, INDEX \`IDX_2a6fb43dc7e7aebcda95e32a10\` (\`organizationTeamId\`), INDEX \`IDX_d15fbe1e1d9c1f56651d8d3831\` (\`taskId\`), PRIMARY KEY (\`organizationTeamId\`, \`taskId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_organization_vendor\` (\`organizationVendorId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_7dde3307daf6d6dec1513ecc56\` (\`organizationVendorId\`), INDEX \`IDX_f71369c1cb86ae9fd4d5452f9a\` (\`tagId\`), PRIMARY KEY (\`organizationVendorId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_organization\` (\`organizationId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_7ca79ff010025397cf9f216bde\` (\`organizationId\`), INDEX \`IDX_f5e70849adc6f2f81fcbccae77\` (\`tagId\`), PRIMARY KEY (\`organizationId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_payment\` (\`paymentId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_1fcb2a337ee905ab36c4aea3a3\` (\`paymentId\`), INDEX \`IDX_e087c0540b5098d115b50d954c\` (\`tagId\`), PRIMARY KEY (\`paymentId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_variant_options_product_option\` (\`productVariantId\` varchar(36) NOT NULL, \`productOptionId\` varchar(36) NOT NULL, INDEX \`IDX_526f0131260eec308a3bd2b61b\` (\`productVariantId\`), INDEX \`IDX_e96a71affe63c97f7fa2f076da\` (\`productOptionId\`), PRIMARY KEY (\`productVariantId\`, \`productOptionId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_product\` (\`productId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_e516b4a2a1a8d4beda7217eeac\` (\`productId\`), INDEX \`IDX_f75a28915b38d926902c0f85b2\` (\`tagId\`), PRIMARY KEY (\`productId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`product_gallery_item\` (\`productId\` varchar(36) NOT NULL, \`imageAssetId\` varchar(36) NOT NULL, INDEX \`IDX_f7187fa710c6a5d22f46192637\` (\`productId\`), INDEX \`IDX_825848065557eac3678b164cee\` (\`imageAssetId\`), PRIMARY KEY (\`productId\`, \`imageAssetId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_proposal\` (\`proposalId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_3f55851a03524e567594d50774\` (\`proposalId\`), INDEX \`IDX_451853704de278eef61a37fa7a\` (\`tagId\`), PRIMARY KEY (\`proposalId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_request_approval\` (\`requestApprovalId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_74938a30181630c480b36e27d7\` (\`requestApprovalId\`), INDEX \`IDX_6c6576bff4b497a4975337fa5e\` (\`tagId\`), PRIMARY KEY (\`requestApprovalId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`skill_employee\` (\`skillId\` varchar(36) NOT NULL, \`employeeId\` varchar(36) NOT NULL, INDEX \`IDX_e699b50ca468e75bbd36913dcc\` (\`skillId\`), INDEX \`IDX_760034f54e598d519b5f0c4ece\` (\`employeeId\`), PRIMARY KEY (\`skillId\`, \`employeeId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`skill_organization\` (\`skillId\` varchar(36) NOT NULL, \`organizationId\` varchar(36) NOT NULL, INDEX \`IDX_61593ade5fed9445738ddbe39c\` (\`skillId\`), INDEX \`IDX_b65cfda00c52e1fc26cc96e52c\` (\`organizationId\`), PRIMARY KEY (\`skillId\`, \`organizationId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_task\` (\`taskId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_4b4e8f61e866248f2ddf8ce181\` (\`taskId\`), INDEX \`IDX_bf7c34187a346f499e4dbc4b08\` (\`tagId\`), PRIMARY KEY (\`taskId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`task_employee\` (\`taskId\` varchar(36) NOT NULL, \`employeeId\` varchar(36) NOT NULL, INDEX \`IDX_790858593698e54cba501eb690\` (\`taskId\`), INDEX \`IDX_f38b1bd46f8831704348003bbf\` (\`employeeId\`), PRIMARY KEY (\`taskId\`, \`employeeId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`task_team\` (\`taskId\` varchar(36) NOT NULL, \`organizationTeamId\` varchar(36) NOT NULL, INDEX \`IDX_47689f911b0cbb16c94a56a9c5\` (\`taskId\`), INDEX \`IDX_0ef34c9f9d6dc8d14f1fbb10e8\` (\`organizationTeamId\`), PRIMARY KEY (\`taskId\`, \`organizationTeamId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`time_slot_time_logs\` (\`timeSlotId\` varchar(36) NOT NULL, \`timeLogId\` varchar(36) NOT NULL, INDEX \`IDX_63c61a88461ff5c115c3b6bcde\` (\`timeSlotId\`), INDEX \`IDX_2fc2675c79cb3cbceb32bf2dc7\` (\`timeLogId\`), PRIMARY KEY (\`timeSlotId\`, \`timeLogId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_user\` (\`userId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_6a58ed56a12604c076a8e0cfda\` (\`userId\`), INDEX \`IDX_e64a306f3215dbb99bbb26ca59\` (\`tagId\`), PRIMARY KEY (\`userId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`tag_warehouse\` (\`warehouseId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_08385e1e045b83d25978568743\` (\`warehouseId\`), INDEX \`IDX_3557d514afd3794d40128e0542\` (\`tagId\`), PRIMARY KEY (\`warehouseId\`, \`tagId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`accounting_template\` ADD CONSTRAINT \`FK_2ca6a49062a4ed884e413bf572e\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`accounting_template\` ADD CONSTRAINT \`FK_e66511b175393255c6c4e7b007f\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`appointment_employee\` ADD CONSTRAINT \`FK_2c0494466d5a7e1165cea3dca98\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`appointment_employee\` ADD CONSTRAINT \`FK_3c3a62226896345c4716bfe1d96\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`appointment_employee\` ADD CONSTRAINT \`FK_0ddc50b7521b9a905d9ca8c8ba3\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`appointment_employee\` ADD CONSTRAINT \`FK_e9ca170a0fae05e44a9bd137d8b\` FOREIGN KEY (\`employeeAppointmentId\`) REFERENCES \`employee_appointment\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`approval_policy\` ADD CONSTRAINT \`FK_1462391059ebe137645098d7276\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`approval_policy\` ADD CONSTRAINT \`FK_dfe3b357df3ce136917b1f09843\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`availability_slot\` ADD CONSTRAINT \`FK_f008a481cb4eed547704bb9d839\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`availability_slot\` ADD CONSTRAINT \`FK_d544bd3a63634a4438509ac958d\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`availability_slot\` ADD CONSTRAINT \`FK_46ed3c2287423f5dc089100feeb\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_criterion_rating\` ADD CONSTRAINT \`FK_9d5bd131452ef689df2b46551b4\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_criterion_rating\` ADD CONSTRAINT \`FK_b106406e94bb7317493efc2c989\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_criterion_rating\` ADD CONSTRAINT \`FK_d1d16bc87d3afaf387f34cdceb7\` FOREIGN KEY (\`technologyId\`) REFERENCES \`candidate_technology\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_criterion_rating\` ADD CONSTRAINT \`FK_ba4c376b2069aa82745d4e96822\` FOREIGN KEY (\`personalQualityId\`) REFERENCES \`candidate_personal_quality\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_criterion_rating\` ADD CONSTRAINT \`FK_159f821dd214792f1d2ad9cff7c\` FOREIGN KEY (\`feedbackId\`) REFERENCES \`candidate_feedback\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_document\` ADD CONSTRAINT \`FK_4d9b7ab09f9f9517d488b5fed1e\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_document\` ADD CONSTRAINT \`FK_d108a827199fda86a9ec216989a\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_document\` ADD CONSTRAINT \`FK_3f9053719c9d11ebdea03e5a2d4\` FOREIGN KEY (\`candidateId\`) REFERENCES \`candidate\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_education\` ADD CONSTRAINT \`FK_00cdd9ed7571be8e2c8d09e7cd4\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_education\` ADD CONSTRAINT \`FK_f660af89b2c69fea2334508cbbd\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_education\` ADD CONSTRAINT \`FK_59b61ba52a58851cfc85b1e6c66\` FOREIGN KEY (\`candidateId\`) REFERENCES \`candidate\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_experience\` ADD CONSTRAINT \`FK_8dcf5fc8bc7f77a80b0fc648bfc\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_experience\` ADD CONSTRAINT \`FK_a50eb955f940ca93e044d175c62\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_experience\` ADD CONSTRAINT \`FK_cf75465b3663652a28cf1841ce2\` FOREIGN KEY (\`candidateId\`) REFERENCES \`candidate\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_feedback\` ADD CONSTRAINT \`FK_6cb21fa0f65ff69679966c836f2\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_feedback\` ADD CONSTRAINT \`FK_3a6928f8501fce33820721a8fe8\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_feedback\` ADD CONSTRAINT \`FK_98c008fd8cf597e83dcdccfd161\` FOREIGN KEY (\`candidateId\`) REFERENCES \`candidate\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_feedback\` ADD CONSTRAINT \`FK_0862c274d336126b951bfe009a7\` FOREIGN KEY (\`interviewId\`) REFERENCES \`candidate_interview\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_feedback\` ADD CONSTRAINT \`FK_44f3d80c3293e1de038c87f115d\` FOREIGN KEY (\`interviewerId\`) REFERENCES \`candidate_interviewer\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interview\` ADD CONSTRAINT \`FK_59b765e6d13d83dba4852a43eb5\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interview\` ADD CONSTRAINT \`FK_03be41e88b1fecfe4e24d6b04b2\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interview\` ADD CONSTRAINT \`FK_91996439c4baafee8395d3df153\` FOREIGN KEY (\`candidateId\`) REFERENCES \`candidate\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interviewer\` ADD CONSTRAINT \`FK_f0ca69c78eea92c95d9044764a2\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interviewer\` ADD CONSTRAINT \`FK_5f1e315db848990dfffa72817ca\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interviewer\` ADD CONSTRAINT \`FK_ecb65075e94b47bbab11cfa5a1e\` FOREIGN KEY (\`interviewId\`) REFERENCES \`candidate_interview\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interviewer\` ADD CONSTRAINT \`FK_9e7b20eb3dfa082b83b198fdad4\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_personal_quality\` ADD CONSTRAINT \`FK_045de7c208adcd0c68c0a651748\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_personal_quality\` ADD CONSTRAINT \`FK_d321f4547ed467d07cce1e7d9a5\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_personal_quality\` ADD CONSTRAINT \`FK_a0d171f45bdbcf2b990c0c37c32\` FOREIGN KEY (\`interviewId\`) REFERENCES \`candidate_interview\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_skill\` ADD CONSTRAINT \`FK_8a07f780c6fce2b82830ab06877\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_skill\` ADD CONSTRAINT \`FK_d7986743e7f11720349a6c95572\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_skill\` ADD CONSTRAINT \`FK_492548e6c176f5655adfae9f5ea\` FOREIGN KEY (\`candidateId\`) REFERENCES \`candidate\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_source\` ADD CONSTRAINT \`FK_b2a1ba27a76dd819cd8294cce38\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_source\` ADD CONSTRAINT \`FK_e92027b5280828cadd7cd6ea719\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_technology\` ADD CONSTRAINT \`FK_a6fecb615b07987b480defac647\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_technology\` ADD CONSTRAINT \`FK_9d46b8c5382acd4d4514bc5c62e\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_technology\` ADD CONSTRAINT \`FK_063663c7e61e45d172d1b832656\` FOREIGN KEY (\`interviewId\`) REFERENCES \`candidate_interview\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate\` ADD CONSTRAINT \`FK_77ac426e04553ff1654421bce4d\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate\` ADD CONSTRAINT \`FK_16fb27ffd1a99c6506c92ad57a7\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate\` ADD CONSTRAINT \`FK_b674793a804b7d69d74c8f6c5ba\` FOREIGN KEY (\`contactId\`) REFERENCES \`contact\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate\` ADD CONSTRAINT \`FK_1e3e8228e7df634fa4cec6322c7\` FOREIGN KEY (\`organizationPositionId\`) REFERENCES \`organization_position\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate\` ADD CONSTRAINT \`FK_4ea108fd8b089237964d5f98fba\` FOREIGN KEY (\`sourceId\`) REFERENCES \`candidate_source\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate\` ADD CONSTRAINT \`FK_3930aa71e0fa24f09201811b1bb\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate\` ADD CONSTRAINT \`FK_8b900e8a39f76125e610ab30c0e\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`contact\` ADD CONSTRAINT \`FK_60468af1ce34043a900809c84f2\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`contact\` ADD CONSTRAINT \`FK_7719d73cd16a9f57ecc6ac24b3d\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`custom_smtp\` ADD CONSTRAINT \`FK_2aa3fc8daa25beec4788d2be26c\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`custom_smtp\` ADD CONSTRAINT \`FK_15a1306132d66c63ef31f7288c1\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`deal\` ADD CONSTRAINT \`FK_46a3c00bfc3e36b4412d8bcdb08\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`deal\` ADD CONSTRAINT \`FK_38fb85abdf9995efcf217f59554\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`deal\` ADD CONSTRAINT \`FK_4b1ff44e6bae5065429dbab554b\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`deal\` ADD CONSTRAINT \`FK_9211f5b62988df6e95522be7daa\` FOREIGN KEY (\`stageId\`) REFERENCES \`pipeline_stage\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`deal\` ADD CONSTRAINT \`FK_1ae3abc0ae1dcf6c13f49b62b56\` FOREIGN KEY (\`clientId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`email_sent\` ADD CONSTRAINT \`FK_0af511c44de7a16beb45cc37852\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`email_sent\` ADD CONSTRAINT \`FK_525f4873c6edc3d94559f88900c\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`email_sent\` ADD CONSTRAINT \`FK_1261c457b3035b77719556995bf\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`email_sent\` ADD CONSTRAINT \`FK_9033faf41b23c61ba201c487969\` FOREIGN KEY (\`emailTemplateId\`) REFERENCES \`email_template\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`email_reset\` ADD CONSTRAINT \`FK_93799dfaeff51de06f1e02ac414\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`email_reset\` ADD CONSTRAINT \`FK_e37af4ab2ba0bf268bfd9826345\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`email_template\` ADD CONSTRAINT \`FK_753e005a45556b5909e11937aaf\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`email_template\` ADD CONSTRAINT \`FK_c160fe6234675fac031aa3e7c50\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_appointment\` ADD CONSTRAINT \`FK_a35637bb659c59e18adb4f38f87\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_appointment\` ADD CONSTRAINT \`FK_86cf36c137712e779dd7e2301e6\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_appointment\` ADD CONSTRAINT \`FK_2f58132c57108540887dc3e88eb\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_award\` ADD CONSTRAINT \`FK_91e0f7efcd17d20b5029fb1342d\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_award\` ADD CONSTRAINT \`FK_caf8363b0ed7d5f24ae866ba3bb\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_award\` ADD CONSTRAINT \`FK_0c5266f3f488add404f92d56ec7\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_upwork_job_search_criterion\` ADD CONSTRAINT \`FK_afe6c40d3d9951388fa05f83f28\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_upwork_job_search_criterion\` ADD CONSTRAINT \`FK_630337302efe97cc93deeb21516\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_upwork_job_search_criterion\` ADD CONSTRAINT \`FK_2dc73e07ac7040f273cea3c999d\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_upwork_job_search_criterion\` ADD CONSTRAINT \`FK_c872e6e3ab28e813c2324d1f4fb\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_upwork_job_search_criterion\` ADD CONSTRAINT \`FK_b6bcd5ceb60e4bb493344a6b4f2\` FOREIGN KEY (\`occupationId\`) REFERENCES \`job_search_occupation\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_upwork_job_search_criterion\` ADD CONSTRAINT \`FK_d2b148ddd67e520fb8061f4c133\` FOREIGN KEY (\`categoryId\`) REFERENCES \`job_search_category\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`job_preset_upwork_job_search_criterion\` ADD CONSTRAINT \`FK_2323220b4decfd2f4d8307fd78f\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`job_preset_upwork_job_search_criterion\` ADD CONSTRAINT \`FK_d5ca48cfacfb516543d6507ca4a\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`job_preset_upwork_job_search_criterion\` ADD CONSTRAINT \`FK_9a687ce1a10a3abda460922cf84\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`job_preset_upwork_job_search_criterion\` ADD CONSTRAINT \`FK_d45b36b85ffbd5189f7e70f29f5\` FOREIGN KEY (\`occupationId\`) REFERENCES \`job_search_occupation\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`job_preset_upwork_job_search_criterion\` ADD CONSTRAINT \`FK_b909a3df761d7e489aca80f138a\` FOREIGN KEY (\`categoryId\`) REFERENCES \`job_search_category\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`job_preset\` ADD CONSTRAINT \`FK_7e53ea80aca15da11a8a5ec0380\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`job_preset\` ADD CONSTRAINT \`FK_a4b038417e3221c0791dd8c7714\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`job_search_category\` ADD CONSTRAINT \`FK_35e120f2b6e5188391cf068d3ba\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`job_search_category\` ADD CONSTRAINT \`FK_86381fb6d28978b101b3aec8ca4\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`job_search_occupation\` ADD CONSTRAINT \`FK_44e22d88b47daf2095491b7cac3\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`job_search_occupation\` ADD CONSTRAINT \`FK_1a62a99e1016e4a2b461e886ecd\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_level\` ADD CONSTRAINT \`FK_d3fc52d497bc44d6f493dbedc3a\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_level\` ADD CONSTRAINT \`FK_c4668533292bf4526e61aedf74a\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_phone\` ADD CONSTRAINT \`FK_d543336994b1f764c449e0b1d3c\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_phone\` ADD CONSTRAINT \`FK_0f9cefa604913e1ab3225915469\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_phone\` ADD CONSTRAINT \`FK_329ebd01a757d1a0c3c4d628e29\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_proposal_template\` ADD CONSTRAINT \`FK_f577c9bc6183c1d1eae1e154bbc\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_proposal_template\` ADD CONSTRAINT \`FK_ee780fbd8f91de31c004929eecb\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_proposal_template\` ADD CONSTRAINT \`FK_2be728a7f8b118712a4200990d4\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recurring_expense\` ADD CONSTRAINT \`FK_5fde7be40b3c03bc0fdac0c2f66\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recurring_expense\` ADD CONSTRAINT \`FK_3ee5147bb1fde625fa33c0e956b\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recurring_expense\` ADD CONSTRAINT \`FK_0ac8526c48a3daa267c86225fb5\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_setting\` ADD CONSTRAINT \`FK_9516a627a131626d2a5738a05a8\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_setting\` ADD CONSTRAINT \`FK_56e96cd218a185ed59b5a8e7869\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_setting\` ADD CONSTRAINT \`FK_95ea18af6ef8123503d332240c2\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee\` ADD CONSTRAINT \`FK_4b3303a6b7eb92d237a4379734e\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee\` ADD CONSTRAINT \`FK_c6a48286f3aa8ae903bee0d1e72\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee\` ADD CONSTRAINT \`FK_f4b0d329c4a3cf79ffe9d565047\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee\` ADD CONSTRAINT \`FK_1c0c1370ecd98040259625e17e2\` FOREIGN KEY (\`contactId\`) REFERENCES \`contact\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee\` ADD CONSTRAINT \`FK_5e719204dcafa8d6b2ecdeda130\` FOREIGN KEY (\`organizationPositionId\`) REFERENCES \`organization_position\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_sharing_policy\` ADD CONSTRAINT \`FK_5443ca8ed830626656d8cfecef7\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_sharing_policy\` ADD CONSTRAINT \`FK_5311a833ff255881454bd5b3b58\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_sharing\` ADD CONSTRAINT \`FK_fa525e61fb3d8d9efec0f364a4b\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_sharing\` ADD CONSTRAINT \`FK_ea9254be07ae4a8604f0aaab196\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_sharing\` ADD CONSTRAINT \`FK_acad51a6362806fc499e583e402\` FOREIGN KEY (\`equipmentId\`) REFERENCES \`equipment\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_sharing\` ADD CONSTRAINT \`FK_0ecfe0ce0cd2b197249d5f1c105\` FOREIGN KEY (\`equipmentSharingPolicyId\`) REFERENCES \`equipment_sharing_policy\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment\` ADD CONSTRAINT \`FK_fb6808468066849ab7b7454d5f3\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment\` ADD CONSTRAINT \`FK_f98ce0d210aa9f91b729d447806\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment\` ADD CONSTRAINT \`FK_0ab80a66282582ae8b0282508e7\` FOREIGN KEY (\`imageId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`estimate_email\` ADD CONSTRAINT \`FK_391d3f83244fea73c619aecadd9\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`estimate_email\` ADD CONSTRAINT \`FK_233c1d351d63441aeb039d1164f\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`event_type\` ADD CONSTRAINT \`FK_92fc62260c0c7ff108622850bff\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`event_type\` ADD CONSTRAINT \`FK_fc8818d6fde74370ec703a01352\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`event_type\` ADD CONSTRAINT \`FK_24d905ec9e127ade23754a363dd\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`expense_category\` ADD CONSTRAINT \`FK_37504e920ee5ca46a4000b89da5\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`expense_category\` ADD CONSTRAINT \`FK_9c9bfe5baaf83f53533ff035fc0\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`expense\` ADD CONSTRAINT \`FK_6d171c9d5f81095436b99da5e62\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`expense\` ADD CONSTRAINT \`FK_c5fb146726ff128e600f23d0a1b\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`expense\` ADD CONSTRAINT \`FK_5e7b197dbac69012dbdb4964f37\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`expense\` ADD CONSTRAINT \`FK_eacb116ab0521ad9b96f2bb53ba\` FOREIGN KEY (\`vendorId\`) REFERENCES \`organization_vendor\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`expense\` ADD CONSTRAINT \`FK_42eea5debc63f4d1bf89881c10a\` FOREIGN KEY (\`categoryId\`) REFERENCES \`expense_category\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`expense\` ADD CONSTRAINT \`FK_9971c4171ae051e74b833984a30\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`expense\` ADD CONSTRAINT \`FK_047b8b5c0782d5a6d4c8bfc1a4e\` FOREIGN KEY (\`organizationContactId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`import-history\` ADD CONSTRAINT \`FK_54868607115e2fee3b0b764eec2\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`import-record\` ADD CONSTRAINT \`FK_a43b235c35c2c4d3263ada770c6\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`feature_organization\` ADD CONSTRAINT \`FK_8f71803d96dcdbcc6b19bb28d38\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`feature_organization\` ADD CONSTRAINT \`FK_6a94e6b0a572f591288ac44a421\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`feature_organization\` ADD CONSTRAINT \`FK_6d413f9fdd5366b1b9add464836\` FOREIGN KEY (\`featureId\`) REFERENCES \`feature\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`feature\` ADD CONSTRAINT \`FK_d4a28a8e70d450a412bf0cfb52a\` FOREIGN KEY (\`parentId\`) REFERENCES \`feature\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_general_setting\` ADD CONSTRAINT \`FK_d17a5159d888ac6320459eda392\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_general_setting\` ADD CONSTRAINT \`FK_e35d0f7b794ca8850669d12c78c\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_kpi_template\` ADD CONSTRAINT \`FK_cc72d4e8e4284dcc8ffbf96caf4\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_kpi_template\` ADD CONSTRAINT \`FK_df7ab026698c02859ff75408093\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_kpi_template\` ADD CONSTRAINT \`FK_f69e740b066c6469d1c68a4a28b\` FOREIGN KEY (\`leadId\`) REFERENCES \`employee\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_kpi\` ADD CONSTRAINT \`FK_43aa2985216560cd9fa93f501e5\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_kpi\` ADD CONSTRAINT \`FK_e49e37fe88a2725a38a3b058493\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_kpi\` ADD CONSTRAINT \`FK_d4f093ca4eb7c40db68d9a789d0\` FOREIGN KEY (\`leadId\`) REFERENCES \`employee\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_template\` ADD CONSTRAINT \`FK_774bf82989475befe301fe1bca5\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_template\` ADD CONSTRAINT \`FK_5708fe06608c72fc77b65ae6519\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_time_frame\` ADD CONSTRAINT \`FK_b56723b53a76ca1c171890c479b\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_time_frame\` ADD CONSTRAINT \`FK_405bc5bba9ed71aefef84a29f10\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal\` ADD CONSTRAINT \`FK_6b4758a5442713070c9a366d0e5\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal\` ADD CONSTRAINT \`FK_c6e8ae55a4db3584686cbf6afe1\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal\` ADD CONSTRAINT \`FK_ac161c1a0c0ff8e83554f097e5e\` FOREIGN KEY (\`ownerTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal\` ADD CONSTRAINT \`FK_35526ff1063ab5fa2b20e71bd66\` FOREIGN KEY (\`ownerEmployeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal\` ADD CONSTRAINT \`FK_af0a11734e70412b742ac339c88\` FOREIGN KEY (\`leadId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`goal\` ADD CONSTRAINT \`FK_4c8b4e887a994182fd6132e6400\` FOREIGN KEY (\`alignedKeyResultId\`) REFERENCES \`key_result\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`image_asset\` ADD CONSTRAINT \`FK_01856a9a730b7e79d70aa661cb0\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`image_asset\` ADD CONSTRAINT \`FK_d3675304df9971cccf96d9a7c34\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`income\` ADD CONSTRAINT \`FK_8608b275644cfc7a0f3f5850814\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`income\` ADD CONSTRAINT \`FK_64409de4711cd14e2c43371cc02\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`income\` ADD CONSTRAINT \`FK_a05d52b7ffe89140f9cbcf114b3\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`income\` ADD CONSTRAINT \`FK_29fbd3a17710a27e6f856072c01\` FOREIGN KEY (\`clientId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_entity_setting_tied\` ADD CONSTRAINT \`FK_b208a754c7a538cb3422f39f5b9\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_entity_setting_tied\` ADD CONSTRAINT \`FK_d5ac36aa3d5919908414154fca0\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_entity_setting_tied\` ADD CONSTRAINT \`FK_3fb863167095805e33f38a0fdcc\` FOREIGN KEY (\`integrationEntitySettingId\`) REFERENCES \`integration_entity_setting\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_entity_setting\` ADD CONSTRAINT \`FK_23e9cfcf1bfff07dcc3254378df\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_entity_setting\` ADD CONSTRAINT \`FK_c6c01e38eebd8b26b9214b90441\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_entity_setting\` ADD CONSTRAINT \`FK_f80ff4ebbf0b33a67dce5989117\` FOREIGN KEY (\`integrationId\`) REFERENCES \`integration_tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_map\` ADD CONSTRAINT \`FK_eec3d6064578610ddc609dd360e\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_map\` ADD CONSTRAINT \`FK_7022dafd72c1b92f7d506914411\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_map\` ADD CONSTRAINT \`FK_c327ea26bda3d349a1eceb5658e\` FOREIGN KEY (\`integrationId\`) REFERENCES \`integration_tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_setting\` ADD CONSTRAINT \`FK_954c6b05297814776d9cb66ca77\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_setting\` ADD CONSTRAINT \`FK_369eaafb13afe9903a170077edb\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_setting\` ADD CONSTRAINT \`FK_34daf030004ad37b88f1f3d863c\` FOREIGN KEY (\`integrationId\`) REFERENCES \`integration_tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_tenant\` ADD CONSTRAINT \`FK_24e37d03ef224f1a16a35069c2c\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_tenant\` ADD CONSTRAINT \`FK_33ab224e7755a46fff5bc1e64e5\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_tenant\` ADD CONSTRAINT \`FK_0d6ddc27d687ca879042c5f3ce3\` FOREIGN KEY (\`integrationId\`) REFERENCES \`integration\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository\` ADD CONSTRAINT \`FK_480158f21938444e4f62fb31857\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository\` ADD CONSTRAINT \`FK_69d75a47af6bfcda545a865691b\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository\` ADD CONSTRAINT \`FK_add7dbec156589dd0b27e2e0c49\` FOREIGN KEY (\`integrationId\`) REFERENCES \`integration_tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository_issue\` ADD CONSTRAINT \`FK_b3234be5b70c2362cdf67bb1889\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository_issue\` ADD CONSTRAINT \`FK_6c8e119fc6a2a7d3413aa76d3bd\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository_issue\` ADD CONSTRAINT \`FK_5065401113abb6e9608225e5678\` FOREIGN KEY (\`repositoryId\`) REFERENCES \`organization_github_repository\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invite\` ADD CONSTRAINT \`FK_7c2328f76efb850b81147972476\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invite\` ADD CONSTRAINT \`FK_68eef4ab86b67747f24f288a16c\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`invite\` ADD CONSTRAINT \`FK_5a182e8b3e225b14ddf6df7e6c3\` FOREIGN KEY (\`invitedById\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invite\` ADD CONSTRAINT \`FK_900a3ed40499c79c1c289fec284\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invite\` ADD CONSTRAINT \`FK_91bfeec7a9574f458e5b592472d\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_estimate_history\` ADD CONSTRAINT \`FK_cc0ac824ba89deda98bb418e8ca\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_estimate_history\` ADD CONSTRAINT \`FK_856f24297f120604f8ae2942769\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_estimate_history\` ADD CONSTRAINT \`FK_da2893697d57368470952a76f65\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_estimate_history\` ADD CONSTRAINT \`FK_31ec3d5a6b0985cec544c642178\` FOREIGN KEY (\`invoiceId\`) REFERENCES \`invoice\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_item\` ADD CONSTRAINT \`FK_f78214cd9de76e80fe8a6305f52\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_item\` ADD CONSTRAINT \`FK_e89749c8e8258b2ec110c0776ff\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_item\` ADD CONSTRAINT \`FK_897c33b49a04cf3db7acd336afc\` FOREIGN KEY (\`expenseId\`) REFERENCES \`expense\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_item\` ADD CONSTRAINT \`FK_553d5aac210d22fdca5c8d48ead\` FOREIGN KEY (\`invoiceId\`) REFERENCES \`invoice\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_item\` ADD CONSTRAINT \`FK_62d486728b272e3b4d23a6b5db6\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_item\` ADD CONSTRAINT \`FK_d4d92abde074b3da8054d7cfbc7\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_item\` ADD CONSTRAINT \`FK_16f1d0e74b4d33e59c0eabdaac7\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_item\` ADD CONSTRAINT \`FK_e558df60d7d9a3e412ef0bbb844\` FOREIGN KEY (\`productId\`) REFERENCES \`product\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice\` ADD CONSTRAINT \`FK_7fb52a5f267f53b7d93af3d8c3c\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice\` ADD CONSTRAINT \`FK_058ef835f99e28fc6717cd7c80f\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice\` ADD CONSTRAINT \`FK_b5c33892e630b66c65d623baf8e\` FOREIGN KEY (\`fromOrganizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice\` ADD CONSTRAINT \`FK_d9e965da0f63c94983d3a1006ac\` FOREIGN KEY (\`toContactId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result_template\` ADD CONSTRAINT \`FK_86c09eb673b0e66129dbdc72111\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result_template\` ADD CONSTRAINT \`FK_fab6b6200b9ed6fd002c1ff62ab\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result_template\` ADD CONSTRAINT \`FK_4bc62c3d2ffdd6f9c7f8b3dcd1c\` FOREIGN KEY (\`kpiId\`) REFERENCES \`goal_kpi_template\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result_template\` ADD CONSTRAINT \`FK_46426ea45456e240a092b732047\` FOREIGN KEY (\`goalId\`) REFERENCES \`goal_template\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result_update\` ADD CONSTRAINT \`FK_cd9cbc0d5b6d62dbb63c3b3a65b\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result_update\` ADD CONSTRAINT \`FK_fd4b0cb7a44ed914acdda55e29c\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result_update\` ADD CONSTRAINT \`FK_7497a70a581e5f56f792015dd37\` FOREIGN KEY (\`keyResultId\`) REFERENCES \`key_result\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result\` ADD CONSTRAINT \`FK_8ac2c6b487d03157adda874789f\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result\` ADD CONSTRAINT \`FK_d1f45ca98f17bd84a5e430feaf4\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result\` ADD CONSTRAINT \`FK_5880347716f9ec5056ec15112cc\` FOREIGN KEY (\`ownerId\`) REFERENCES \`employee\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result\` ADD CONSTRAINT \`FK_c89adeff0de3aedb2e772a5bf4c\` FOREIGN KEY (\`leadId\`) REFERENCES \`employee\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result\` ADD CONSTRAINT \`FK_38dc003f3484eff4b59918e9ae3\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result\` ADD CONSTRAINT \`FK_d8547e21ccb8e37ac9f0d69c1af\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result\` ADD CONSTRAINT \`FK_4e1e975124c1d717814a4bb2ec8\` FOREIGN KEY (\`kpiId\`) REFERENCES \`goal_kpi\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result\` ADD CONSTRAINT \`FK_3e1d08761a717c1dd71fe67249b\` FOREIGN KEY (\`goalId\`) REFERENCES \`goal\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`merchant\` ADD CONSTRAINT \`FK_533144d7ae94180235ea456625b\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`merchant\` ADD CONSTRAINT \`FK_d306a524b507f72fa8550aeffe4\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`merchant\` ADD CONSTRAINT \`FK_e03ddff05652be527e04abdc56f\` FOREIGN KEY (\`contactId\`) REFERENCES \`contact\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`merchant\` ADD CONSTRAINT \`FK_20acc3c3a6c900c6ef9fc681996\` FOREIGN KEY (\`logoId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_award\` ADD CONSTRAINT \`FK_af6423760433da72002a7f369eb\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_award\` ADD CONSTRAINT \`FK_2e0d21aab892b5993abaac09bcd\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_contact\` ADD CONSTRAINT \`FK_e68c43e315ad3aaea4e99cf461d\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_contact\` ADD CONSTRAINT \`FK_6200736cb4d3617b004e5b647ff\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_contact\` ADD CONSTRAINT \`FK_a86d2e378b953cb39261f457d26\` FOREIGN KEY (\`contactId\`) REFERENCES \`contact\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_contact\` ADD CONSTRAINT \`FK_8cfcdc6bc8fb55e273d9ace5fd5\` FOREIGN KEY (\`imageId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_department\` ADD CONSTRAINT \`FK_b3644ff7cd65239e29d292a41d1\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_department\` ADD CONSTRAINT \`FK_c61a562a2379d1c0077fe7de332\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_document\` ADD CONSTRAINT \`FK_4bc83945c022a862a33629ff1e1\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_document\` ADD CONSTRAINT \`FK_1057ec001a4c6b258658143047a\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_document\` ADD CONSTRAINT \`FK_c129dee7d1cb84e01e69b5e2c66\` FOREIGN KEY (\`documentId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_employment_type\` ADD CONSTRAINT \`FK_227b5bd9867287cbbeece8f6ba9\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_employment_type\` ADD CONSTRAINT \`FK_a583cfe32f492f5ba99b7bb2050\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_language\` ADD CONSTRAINT \`FK_225e476592214e32e117a85213c\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_language\` ADD CONSTRAINT \`FK_4513931e2d530f78d7144c8c7cd\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_language\` ADD CONSTRAINT \`FK_020516e74a57cb85d75381e841a\` FOREIGN KEY (\`languageCode\`) REFERENCES \`language\`(\`code\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_position\` ADD CONSTRAINT \`FK_a8f497b1006ec967964abb0d497\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_position\` ADD CONSTRAINT \`FK_a0409e39f23ff6d418f2c03df58\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` ADD CONSTRAINT \`FK_7cf84e8b5775f349f81a1f3cc44\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` ADD CONSTRAINT \`FK_9d8afc1e1e64d4b7d48dd2229d7\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` ADD CONSTRAINT \`FK_904ae0b765faef6ba2db8b1e698\` FOREIGN KEY (\`repositoryId\`) REFERENCES \`organization_github_repository\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` ADD CONSTRAINT \`FK_bc1e32c13683dbb16ada1c6da14\` FOREIGN KEY (\`organizationContactId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` ADD CONSTRAINT \`FK_063324fdceb51f7086e401ed2c9\` FOREIGN KEY (\`imageId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_recurring_expense\` ADD CONSTRAINT \`FK_0b19a287858af40661bd3eb7411\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_recurring_expense\` ADD CONSTRAINT \`FK_8a12e7a0d47d3c6a6b35f7984e3\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint\` ADD CONSTRAINT \`FK_f57ad03c4e471bd8530494ea63d\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint\` ADD CONSTRAINT \`FK_8a1fe8afb3aa672bae5993fbe7d\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint\` ADD CONSTRAINT \`FK_a140b7e30ff3455551a0fd599fb\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_task_setting\` ADD CONSTRAINT \`FK_582768159ef0c749e8552ea9bcd\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_task_setting\` ADD CONSTRAINT \`FK_5830901876e426adfc15fb7341b\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_task_setting\` ADD CONSTRAINT \`FK_19ab7adf33199bc6f913db277d7\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_task_setting\` ADD CONSTRAINT \`FK_20a290f166c0810eafbf2717171\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_employee\` ADD CONSTRAINT \`FK_fe12e1b76bbb76209134d9bdc2e\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_employee\` ADD CONSTRAINT \`FK_d8eba1c0e500c60be1b69c1e777\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_employee\` ADD CONSTRAINT \`FK_719aeb37fa7a1dd80d25336a0cf\` FOREIGN KEY (\`activeTaskId\`) REFERENCES \`task\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_employee\` ADD CONSTRAINT \`FK_8dc83cdd7c519d73afc0d8bdf09\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_employee\` ADD CONSTRAINT \`FK_a2a5601d799fbfc29c17b99243f\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_employee\` ADD CONSTRAINT \`FK_ce83034f38496f5fe3f19796977\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_join_request\` ADD CONSTRAINT \`FK_d9529008c733cb90044b8c2ad6b\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_join_request\` ADD CONSTRAINT \`FK_c15823bf3f63b1fe331d9de6625\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_join_request\` ADD CONSTRAINT \`FK_5e73656ce0355347477c42ae19b\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_join_request\` ADD CONSTRAINT \`FK_171b852be7c1f387eca93775aad\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team\` ADD CONSTRAINT \`FK_176f5ed3c4534f3110d423d5690\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team\` ADD CONSTRAINT \`FK_eef1c19a0cb5321223cfe3286c4\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team\` ADD CONSTRAINT \`FK_da625f694eb1e23e585f3010082\` FOREIGN KEY (\`createdById\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team\` ADD CONSTRAINT \`FK_51e91be110fa0b8e70066f5727f\` FOREIGN KEY (\`imageId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_vendor\` ADD CONSTRAINT \`FK_7e0bf6063e1728c9813d5da7caa\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_vendor\` ADD CONSTRAINT \`FK_56dd132aa3743cfa9b034d020eb\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization\` ADD CONSTRAINT \`FK_745a293c8b2c750bc421fa06332\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization\` ADD CONSTRAINT \`FK_7965db2b12872551b586f76dd79\` FOREIGN KEY (\`contactId\`) REFERENCES \`contact\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization\` ADD CONSTRAINT \`FK_47b6a97e09895a06606a4a80421\` FOREIGN KEY (\`imageId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`password_reset\` ADD CONSTRAINT \`FK_1fa632f2d12a06ef8dcc00858ff\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_6959c37c3acf0832103a2535703\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_be7fcc9fb8cd5a74cb602ec6c9b\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_62ef561a3bb084a7d12dad8a2d9\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_87223c7f1d4c2ca51cf69927844\` FOREIGN KEY (\`invoiceId\`) REFERENCES \`invoice\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_3f13c738eff604a85700746ec7d\` FOREIGN KEY (\`recordedById\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_8846e403ec45e1ad8c309f91a37\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_82753b9e315af84b20eaf84d778\` FOREIGN KEY (\`organizationContactId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pipeline_stage\` ADD CONSTRAINT \`FK_28965bf63ad4c0976892d0fd5e8\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pipeline_stage\` ADD CONSTRAINT \`FK_04d16bdd72668de12c3e41a85a6\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`pipeline_stage\` ADD CONSTRAINT \`FK_73ec3158bf224b485fd715cb3a6\` FOREIGN KEY (\`pipelineId\`) REFERENCES \`pipeline\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pipeline\` ADD CONSTRAINT \`FK_683274c59fb08b21249096e305c\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`pipeline\` ADD CONSTRAINT \`FK_873ade98fbd6ca71c8b4d1bbcac\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_category_translation\` ADD CONSTRAINT \`FK_27d71aa2e843f07fbf36329be3f\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_category_translation\` ADD CONSTRAINT \`FK_e46203bf1dbf3291d174f02cb34\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_category_translation\` ADD CONSTRAINT \`FK_586294149d24cd835678878ef12\` FOREIGN KEY (\`referenceId\`) REFERENCES \`product_category\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_category\` ADD CONSTRAINT \`FK_0a0cf25cd8232a154d1cce2641c\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_category\` ADD CONSTRAINT \`FK_853302351eaa4daa39920c270a9\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_category\` ADD CONSTRAINT \`FK_f38e86bd280ff9c9c7d9cb78393\` FOREIGN KEY (\`imageId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_group\` ADD CONSTRAINT \`FK_462a7fd3ce68935cf973c6709f9\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_group\` ADD CONSTRAINT \`FK_4a1430a01b71ecdfcd54b2b6c5c\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_group\` ADD CONSTRAINT \`FK_a6e91739227bf4d442f23c52c75\` FOREIGN KEY (\`productId\`) REFERENCES \`product\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_group_translation\` ADD CONSTRAINT \`FK_fd6b39f1fd1db026b5dcc3c7953\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_group_translation\` ADD CONSTRAINT \`FK_0e2fcc31743e20a45fc3cf0211d\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_group_translation\` ADD CONSTRAINT \`FK_c9ce1da98b6d93293daafee63aa\` FOREIGN KEY (\`referenceId\`) REFERENCES \`product_option_group\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_translation\` ADD CONSTRAINT \`FK_9869d7680f48487e584f5d2fca7\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_translation\` ADD CONSTRAINT \`FK_4dc2f466cfa3d0b7fef19d12731\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_translation\` ADD CONSTRAINT \`FK_f43c46e12db0580af320db77381\` FOREIGN KEY (\`referenceId\`) REFERENCES \`product_option\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option\` ADD CONSTRAINT \`FK_985d235aa5394937c4493262c7f\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option\` ADD CONSTRAINT \`FK_47ffb82a65c43f102b7e0efa41a\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option\` ADD CONSTRAINT \`FK_a6debf9198e2fbfa006aa10d710\` FOREIGN KEY (\`groupId\`) REFERENCES \`product_option_group\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_setting\` ADD CONSTRAINT \`FK_2efe48435d4ba480a4bb8b96fa6\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_setting\` ADD CONSTRAINT \`FK_bed9d45e15866d9b8e87e7a7bfe\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_setting\` ADD CONSTRAINT \`FK_b0d86990fe7160a5f3e4011fb23\` FOREIGN KEY (\`productVariantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_type_translation\` ADD CONSTRAINT \`FK_30aafca59cdb456bf5231f9e463\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_type_translation\` ADD CONSTRAINT \`FK_2dd271bdeb602b8c3956287e33c\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_type_translation\` ADD CONSTRAINT \`FK_f4b767c43b4e9130c63382c9b28\` FOREIGN KEY (\`referenceId\`) REFERENCES \`product_type\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_type\` ADD CONSTRAINT \`FK_f206c807fc7e41fc8a8b6679ae0\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_type\` ADD CONSTRAINT \`FK_e4e4120b0c19d3a207ce38d7581\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_price\` ADD CONSTRAINT \`FK_7052eaf00a5795afa5ebf359950\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_price\` ADD CONSTRAINT \`FK_0cfba32db58a952f58b1e35cf1c\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_price\` ADD CONSTRAINT \`FK_5842f603bd85d924127d63d73cd\` FOREIGN KEY (\`productVariantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant\` ADD CONSTRAINT \`FK_9121e00c4dc3500dc610cf8722e\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant\` ADD CONSTRAINT \`FK_6a289b10030ae86903406e3c9bd\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant\` ADD CONSTRAINT \`FK_41b31a71dda350cfe5da07e0e4f\` FOREIGN KEY (\`priceId\`) REFERENCES \`product_variant_price\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant\` ADD CONSTRAINT \`FK_9f0fd369dfeb275415c649d110b\` FOREIGN KEY (\`settingId\`) REFERENCES \`product_variant_setting\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant\` ADD CONSTRAINT \`FK_6e420052844edf3a5506d863ce6\` FOREIGN KEY (\`productId\`) REFERENCES \`product\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant\` ADD CONSTRAINT \`FK_b83f23626741630a86299607156\` FOREIGN KEY (\`imageId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product\` ADD CONSTRAINT \`FK_08293ca31a601d3cd0228120bc9\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product\` ADD CONSTRAINT \`FK_32a4bdd261ec81f4ca6b3abe262\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product\` ADD CONSTRAINT \`FK_4627873dbc1af07d732e6eec7be\` FOREIGN KEY (\`featuredImageId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product\` ADD CONSTRAINT \`FK_374bfd0d1b0e1398d7206456d98\` FOREIGN KEY (\`productTypeId\`) REFERENCES \`product_type\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product\` ADD CONSTRAINT \`FK_618194d24a7ea86a165d7ec628e\` FOREIGN KEY (\`productCategoryId\`) REFERENCES \`product_category\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_translation\` ADD CONSTRAINT \`FK_7533fd275bfb3219ce9eb4004c7\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_translation\` ADD CONSTRAINT \`FK_e6abcacc3d3a4f9cf5ca97f2b28\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_translation\` ADD CONSTRAINT \`FK_d24bc28e54f1dc296452a255917\` FOREIGN KEY (\`referenceId\`) REFERENCES \`product\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`proposal\` ADD CONSTRAINT \`FK_4177329f5e6ddbfb64165927134\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`proposal\` ADD CONSTRAINT \`FK_d59ec6899d435f430799795ad7b\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`proposal\` ADD CONSTRAINT \`FK_f399488a0f3ea10bb511e3f5aa3\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`proposal\` ADD CONSTRAINT \`FK_61c45ab51852e4b0e539756d40f\` FOREIGN KEY (\`organizationContactId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`report_organization\` ADD CONSTRAINT \`FK_edf9bd011d7f08e3e18a5becb8b\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`report_organization\` ADD CONSTRAINT \`FK_5193788a3ebc1143bedb74cf725\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`report_organization\` ADD CONSTRAINT \`FK_a085d6f9bcfd19f8bae1dbfe135\` FOREIGN KEY (\`reportId\`) REFERENCES \`report\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`report\` ADD CONSTRAINT \`FK_230652e48daa99c50c000fc5d10\` FOREIGN KEY (\`categoryId\`) REFERENCES \`report_category\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_employee\` ADD CONSTRAINT \`FK_a5445b38b780b29b09369e36a9b\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_employee\` ADD CONSTRAINT \`FK_4071f027554eefff65ac8123e6e\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_employee\` ADD CONSTRAINT \`FK_563fec5539b89a57f40731f9858\` FOREIGN KEY (\`requestApprovalId\`) REFERENCES \`request_approval\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_employee\` ADD CONSTRAINT \`FK_ce2113039f070b3f003aa0db611\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_team\` ADD CONSTRAINT \`FK_94b2a3d0f17c9549dea1493dc96\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_team\` ADD CONSTRAINT \`FK_77e1050669b32cfff482f960169\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_team\` ADD CONSTRAINT \`FK_6c75d8a8c609e88896b2653cc41\` FOREIGN KEY (\`requestApprovalId\`) REFERENCES \`request_approval\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_team\` ADD CONSTRAINT \`FK_9ccdaee6c5c62cda8f7375e8417\` FOREIGN KEY (\`teamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval\` ADD CONSTRAINT \`FK_9feaa23ed7bc47d51315e304bb5\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval\` ADD CONSTRAINT \`FK_8343741e7929043b2a7de89f739\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval\` ADD CONSTRAINT \`FK_26bb3420001d31337393ed05bc3\` FOREIGN KEY (\`approvalPolicyId\`) REFERENCES \`approval_policy\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`role_permission\` ADD CONSTRAINT \`FK_cbd053921056e77c0a8e03122af\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`role_permission\` ADD CONSTRAINT \`FK_e3130a39c1e4a740d044e685730\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`role\` ADD CONSTRAINT \`FK_1751a572e91385a09d41c624714\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`skill\` ADD CONSTRAINT \`FK_8e502eac7ed1347c71c26beae81\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`skill\` ADD CONSTRAINT \`FK_b2923d394f3636671ff9b3c3e81\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag\` ADD CONSTRAINT \`FK_b08dd29fb6a8acdf83c83d8988f\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag\` ADD CONSTRAINT \`FK_c2f6bec0b39eaa3a6d90903ae99\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag\` ADD CONSTRAINT \`FK_49746602acc4e5e8721062b69ec\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_estimation\` ADD CONSTRAINT \`FK_87bfea6d0b9a1ec602ee88e5f68\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_estimation\` ADD CONSTRAINT \`FK_16507eb222e3c50be077fb4ace2\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_estimation\` ADD CONSTRAINT \`FK_8f274646f2bdf4e12990feeb040\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_estimation\` ADD CONSTRAINT \`FK_a3ee022203211f678376cd919bb\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`issue_type\` ADD CONSTRAINT \`FK_8b12c913c39c72fe5980427c963\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`issue_type\` ADD CONSTRAINT \`FK_16dbef9d1b2b422abdce8ee3ae2\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`issue_type\` ADD CONSTRAINT \`FK_33779b0395f72af0b50dc526d1d\` FOREIGN KEY (\`imageId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`issue_type\` ADD CONSTRAINT \`FK_131331557078611a68b4a5b2e7e\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`issue_type\` ADD CONSTRAINT \`FK_586513cceb16777fd14a17bfe10\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task\` ADD CONSTRAINT \`FK_e91cbff3d206f150ccc14d0c3a1\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task\` ADD CONSTRAINT \`FK_5b0272d923a31c972bed1a1ac4d\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`task\` ADD CONSTRAINT \`FK_8c9920b5fb32c3d8453f64b705c\` FOREIGN KEY (\`parentId\`) REFERENCES \`task\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task\` ADD CONSTRAINT \`FK_3797a20ef5553ae87af126bc2fe\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task\` ADD CONSTRAINT \`FK_94fe6b3a5aec5f85427df4f8cd7\` FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task\` ADD CONSTRAINT \`FK_1e1f64696aa3a26d3e12c840e55\` FOREIGN KEY (\`organizationSprintId\`) REFERENCES \`organization_sprint\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task\` ADD CONSTRAINT \`FK_0cbe714983eb0aae5feeee8212b\` FOREIGN KEY (\`taskStatusId\`) REFERENCES \`task_status\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task\` ADD CONSTRAINT \`FK_2f4bdd2593fd6038aaa91fd1076\` FOREIGN KEY (\`taskSizeId\`) REFERENCES \`task_size\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task\` ADD CONSTRAINT \`FK_b8616deefe44d0622233e73fbf9\` FOREIGN KEY (\`taskPriorityId\`) REFERENCES \`task_priority\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_linked_issues\` ADD CONSTRAINT \`FK_20b50abc5c97610a75d49ad3817\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_linked_issues\` ADD CONSTRAINT \`FK_24114c4059e6b6991daba541b1d\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_linked_issues\` ADD CONSTRAINT \`FK_6deea7b3671e45973e191a1502c\` FOREIGN KEY (\`taskFromId\`) REFERENCES \`task\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_linked_issues\` ADD CONSTRAINT \`FK_0848fd2b8c23c0ab55146297cff\` FOREIGN KEY (\`taskToId\`) REFERENCES \`task\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_priority\` ADD CONSTRAINT \`FK_1818655f27b8cf4f0d1dbfeb8db\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_priority\` ADD CONSTRAINT \`FK_7fd1b30d159b608cbf59009f681\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_priority\` ADD CONSTRAINT \`FK_db4237960ca989eb7a48cd433b1\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_priority\` ADD CONSTRAINT \`FK_52b039cff6a1adf6b7f9e49ee44\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_related_issue_type\` ADD CONSTRAINT \`FK_b7b0ea8ac2825fb981c1181d115\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_related_issue_type\` ADD CONSTRAINT \`FK_bed691e21fe01cf5aceee722952\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_related_issue_type\` ADD CONSTRAINT \`FK_d99fe5b50dbe5078e0d9a9b6a9d\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_related_issue_type\` ADD CONSTRAINT \`FK_4967ebdca0aefb9d43e56695e42\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_size\` ADD CONSTRAINT \`FK_f6ec2207e50680a475d71c89793\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_size\` ADD CONSTRAINT \`FK_596512cc6508a482cc23ae6ab78\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_size\` ADD CONSTRAINT \`FK_ad6792b26526bd96ab18d634544\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_size\` ADD CONSTRAINT \`FK_f4438327b3c2afb0832569b2a1e\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_status\` ADD CONSTRAINT \`FK_efbaf00a743316b394cc31e4a20\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_status\` ADD CONSTRAINT \`FK_9b9a828a49f4bd6383a4073fe23\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_status\` ADD CONSTRAINT \`FK_a19e8975e5c296640d457dfc11f\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_status\` ADD CONSTRAINT \`FK_0330b4a942b536d8d1f264abe32\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_version\` ADD CONSTRAINT \`FK_379c8bd0ce203341148c1f99ee7\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_version\` ADD CONSTRAINT \`FK_9c845f353378371ee3aa60f6865\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_version\` ADD CONSTRAINT \`FK_91988120385964f213aec8aa84c\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_version\` ADD CONSTRAINT \`FK_959e77718a2e76ee56498c1106a\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tenant_setting\` ADD CONSTRAINT \`FK_affdab301e348b892175f30fa39\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tenant\` ADD CONSTRAINT \`FK_d154d06dac0d0e0a5d9a083e253\` FOREIGN KEY (\`imageId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_policy\` ADD CONSTRAINT \`FK_1c0ed84d54f8fbe4af10dfcda1c\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_policy\` ADD CONSTRAINT \`FK_c2744cffeca55c3c9c52bb9789c\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_request\` ADD CONSTRAINT \`FK_4989834dd1c9c8ea3576ed99ce5\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_request\` ADD CONSTRAINT \`FK_981333982a6df8b815957dcbf27\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_request\` ADD CONSTRAINT \`FK_c1f8ae47dc2f1882afc5045c739\` FOREIGN KEY (\`policyId\`) REFERENCES \`time_off_policy\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_request\` ADD CONSTRAINT \`FK_c009cdd795be674c20470623742\` FOREIGN KEY (\`documentId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`activity\` ADD CONSTRAINT \`FK_f2401d8fdff5d8970dfe30d3aed\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`activity\` ADD CONSTRAINT \`FK_fdb3f018c2bba4885bfa5757d16\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`activity\` ADD CONSTRAINT \`FK_a6f74ae99d549932391f0f44609\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`activity\` ADD CONSTRAINT \`FK_5a898f44fa31ef7916f0c38b016\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`activity\` ADD CONSTRAINT \`FK_4e382caaf07ab0923b2e06bf918\` FOREIGN KEY (\`timeSlotId\`) REFERENCES \`time_slot\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`activity\` ADD CONSTRAINT \`FK_2743f8990fde12f9586287eb09f\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`screenshot\` ADD CONSTRAINT \`FK_235004f3dafac90692cd64d9158\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`screenshot\` ADD CONSTRAINT \`FK_0951aacffe3f8d0cff54cf2f341\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`screenshot\` ADD CONSTRAINT \`FK_5b594d02d98d5defcde323abe5b\` FOREIGN KEY (\`timeSlotId\`) REFERENCES \`time_slot\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`screenshot\` ADD CONSTRAINT \`FK_fa1896dc735403799311968f7ec\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_log\` ADD CONSTRAINT \`FK_fa9018cb248ea0f3b2b30ef143b\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_log\` ADD CONSTRAINT \`FK_aed2d5cc5680fba9d387c7f931d\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_log\` ADD CONSTRAINT \`FK_a89a849957e005bafb8e4220bc7\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_log\` ADD CONSTRAINT \`FK_e65393bb52aa8275b1392c73f72\` FOREIGN KEY (\`timesheetId\`) REFERENCES \`timesheet\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_log\` ADD CONSTRAINT \`FK_54776f6f5fd3c13c3bc1fbfac5b\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_log\` ADD CONSTRAINT \`FK_1ddf2da35e34378fd845d80a18b\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_log\` ADD CONSTRAINT \`FK_d1e8f22c02c5e949453dde7f2d1\` FOREIGN KEY (\`organizationContactId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_log\` ADD CONSTRAINT \`FK_18dcdf754396f0cb0308dc91f4c\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot\` ADD CONSTRAINT \`FK_b8284109257b5137256b5b3e848\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot\` ADD CONSTRAINT \`FK_b407841271245501dd1a8c75513\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot\` ADD CONSTRAINT \`FK_7913305b850c7afc89b6ed96a30\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_minute\` ADD CONSTRAINT \`FK_c7f72cb68b22b8ab988158e4d26\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_minute\` ADD CONSTRAINT \`FK_82c5edbd179359212f16f0d386a\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_minute\` ADD CONSTRAINT \`FK_9272701d3da8bd8507f316c9154\` FOREIGN KEY (\`timeSlotId\`) REFERENCES \`time_slot\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet\` ADD CONSTRAINT \`FK_25b8df69c9b7f5752c6a6a6ef7f\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet\` ADD CONSTRAINT \`FK_aca65a79fe0c1ec9e6a59022c54\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet\` ADD CONSTRAINT \`FK_8c8f821cb0fe0dd387491ea7d9e\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`timesheet\` ADD CONSTRAINT \`FK_6c1f81934a3f597b3b1a17f5623\` FOREIGN KEY (\`approvedById\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`user_organization\` ADD CONSTRAINT \`FK_611e1392c8cc9b101e3ea7ad80c\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`user_organization\` ADD CONSTRAINT \`FK_7143f31467178a6164a42426c15\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`user_organization\` ADD CONSTRAINT \`FK_29c3c8cc3ea9db22e4a347f4b5a\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`user\` ADD CONSTRAINT \`FK_685bf353c85f23b6f848e4dcded\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`user\` ADD CONSTRAINT \`FK_c28e52f758e7bbc53828db92194\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`user\` ADD CONSTRAINT \`FK_5e028298e103e1694147ada69e5\` FOREIGN KEY (\`imageId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product\` ADD CONSTRAINT \`FK_62573a939f834f2de343f98288c\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product\` ADD CONSTRAINT \`FK_c899e17322d11e1977832e8c656\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product\` ADD CONSTRAINT \`FK_a8c9aee14d47ec7b3f2ac429ebc\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product\` ADD CONSTRAINT \`FK_3f934c4772e7c7f2c66d7ea4e72\` FOREIGN KEY (\`productId\`) REFERENCES \`product\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product_variant\` ADD CONSTRAINT \`FK_a1c4a97b928b547c3041d3ac1f6\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product_variant\` ADD CONSTRAINT \`FK_d5f4b64e6a80546fd6dd4ac3ed0\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product_variant\` ADD CONSTRAINT \`FK_a2f863689d1316810c41c1ea38e\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product_variant\` ADD CONSTRAINT \`FK_617306cb3613dd8d59301ae16fd\` FOREIGN KEY (\`warehouseProductId\`) REFERENCES \`warehouse_product\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse\` ADD CONSTRAINT \`FK_9b2f00761a6b1b77cb6289e3fff\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse\` ADD CONSTRAINT \`FK_f5735eafddabdb4b20f621a976a\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse\` ADD CONSTRAINT \`FK_f502dc6d9802306f9d1584932b8\` FOREIGN KEY (\`logoId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse\` ADD CONSTRAINT \`FK_84594016a98da8b87e0f51cd931\` FOREIGN KEY (\`contactId\`) REFERENCES \`contact\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base\` ADD CONSTRAINT \`FK_bcb30c9893f4c8d0c4e556b4ed3\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base\` ADD CONSTRAINT \`FK_2ba72a9dec732a10e8c05bcdec1\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base\` ADD CONSTRAINT \`FK_ff979040ce93cbc60863d322ecd\` FOREIGN KEY (\`parentId\`) REFERENCES \`knowledge_base\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_article\` ADD CONSTRAINT \`FK_06a9902fedc1f9dcdbaf14afb01\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_article\` ADD CONSTRAINT \`FK_3547f82f867489542ceae58a49e\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_article\` ADD CONSTRAINT \`FK_66af194845635058239e794e1b9\` FOREIGN KEY (\`categoryId\`) REFERENCES \`knowledge_base\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_author\` ADD CONSTRAINT \`FK_1551e821871d9230cc0dafbbe58\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_author\` ADD CONSTRAINT \`FK_81558bb2bef673628d92540b4e4\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_author\` ADD CONSTRAINT \`FK_8eb7e413257d7a26104f4e326fd\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_author\` ADD CONSTRAINT \`FK_2d5ecab1f06b327bad545536143\` FOREIGN KEY (\`articleId\`) REFERENCES \`knowledge_base_article\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`changelog\` ADD CONSTRAINT \`FK_744268ee0ec6073883267bc3b66\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`changelog\` ADD CONSTRAINT \`FK_c2037b621d2e8023898aee4ac74\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_candidate\` ADD CONSTRAINT \`FK_34e4625cc9b010079f1b5758b36\` FOREIGN KEY (\`candidateId\`) REFERENCES \`candidate\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_candidate\` ADD CONSTRAINT \`FK_7e0891bb331b08bd4abb6776b76\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_68e75e49f06409fd385b4f87746\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_employee_level\` ADD CONSTRAINT \`FK_b3565ff8073d4f66c46d27fe88e\` FOREIGN KEY (\`employeeLevelId\`) REFERENCES \`employee_level\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_employee_level\` ADD CONSTRAINT \`FK_f3caf4cc158fe8b8e06578e7922\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_6b5b0c3d994f59d9c800922257f\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_2ba868f42c2301075b7c141359e\` FOREIGN KEY (\`organizationProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_employee\` ADD CONSTRAINT \`FK_e0ddfccfe9816681c410ebf2b9a\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_employee\` ADD CONSTRAINT \`FK_b1ffe2a63a48b486e18dc59d1b7\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_policy_employee\` ADD CONSTRAINT \`FK_c451f53f5a6cd97db94e1c9482d\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_policy_employee\` ADD CONSTRAINT \`FK_0f823750ac5a7d899cc5d8d0402\` FOREIGN KEY (\`timeOffPolicyId\`) REFERENCES \`time_off_policy\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_request_employee\` ADD CONSTRAINT \`FK_cd312469204347b1210397770a1\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_request_employee\` ADD CONSTRAINT \`FK_0a8cf0aacf95ce66e73e75a95cf\` FOREIGN KEY (\`timeOffRequestId\`) REFERENCES \`time_off_request\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_tasks_task\` ADD CONSTRAINT \`FK_eae5eea1c6a3fcf4a2c95f1a5fe\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_tasks_task\` ADD CONSTRAINT \`FK_6bbbe677c5fc5115916b4eccfb1\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_shares_employees\` ADD CONSTRAINT \`FK_8676224f55a965c53e4bb7cbf8f\` FOREIGN KEY (\`equipmentSharingId\`) REFERENCES \`equipment_sharing\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_shares_employees\` ADD CONSTRAINT \`FK_57f6461f1a710f0f4abdcb8d0e6\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_shares_teams\` ADD CONSTRAINT \`FK_f84171695b7aedfc454483bcf21\` FOREIGN KEY (\`equipmentSharingId\`) REFERENCES \`equipment_sharing\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_shares_teams\` ADD CONSTRAINT \`FK_7ccef49dd56c8c74daa8d12186b\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_equipment\` ADD CONSTRAINT \`FK_bb0062d51a75164fcb64041ee7d\` FOREIGN KEY (\`equipmentId\`) REFERENCES \`equipment\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_equipment\` ADD CONSTRAINT \`FK_0360b8197c2a38d6fe882cb1aff\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_event_type\` ADD CONSTRAINT \`FK_094af399a26d4a1d3ae17ea11e3\` FOREIGN KEY (\`eventTypeId\`) REFERENCES \`event_type\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_event_type\` ADD CONSTRAINT \`FK_34b8f471aac00eaec6f2830e5bb\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_expense_category\` ADD CONSTRAINT \`FK_107a93f89c8f31f4386ae4b19d9\` FOREIGN KEY (\`expenseCategoryId\`) REFERENCES \`expense_category\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_expense_category\` ADD CONSTRAINT \`FK_727dbf5e1100023681e216d6a93\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_expense\` ADD CONSTRAINT \`FK_6f1108552ea7a70a4d958b338cd\` FOREIGN KEY (\`expenseId\`) REFERENCES \`expense\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_expense\` ADD CONSTRAINT \`FK_8dcfbd0d960672fefe681bcba9c\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_income\` ADD CONSTRAINT \`FK_55c9568ebe1c4addc3deb6922e5\` FOREIGN KEY (\`incomeId\`) REFERENCES \`income\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_income\` ADD CONSTRAINT \`FK_00e2fd30761a36911648166044c\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_integration_type\` ADD CONSTRAINT \`FK_34c86921ee9b462bc5c7b61fad4\` FOREIGN KEY (\`integrationId\`) REFERENCES \`integration\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_integration_type\` ADD CONSTRAINT \`FK_8dd2062499a6c2a708ddd05650e\` FOREIGN KEY (\`integrationTypeId\`) REFERENCES \`integration_type\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_integration\` ADD CONSTRAINT \`FK_c9a85b16615bc5c3035802adb04\` FOREIGN KEY (\`integrationId\`) REFERENCES \`integration\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_integration\` ADD CONSTRAINT \`FK_0f19ad9872190b7a67a9652d5e1\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_project\` ADD CONSTRAINT \`FK_020325728f0979a2822a8295653\` FOREIGN KEY (\`inviteId\`) REFERENCES \`invite\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_project\` ADD CONSTRAINT \`FK_f2806968dd846cb49fcdac195a0\` FOREIGN KEY (\`organizationProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_contact\` ADD CONSTRAINT \`FK_a0c92b6393c7a13266003d552ef\` FOREIGN KEY (\`inviteId\`) REFERENCES \`invite\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_contact\` ADD CONSTRAINT \`FK_c5a147ce2a0ec69ccc61149262d\` FOREIGN KEY (\`organizationContactId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_department\` ADD CONSTRAINT \`FK_0935b93b3498a0f98db1af71760\` FOREIGN KEY (\`inviteId\`) REFERENCES \`invite\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_department\` ADD CONSTRAINT \`FK_fe2eea7a939442efde885303efd\` FOREIGN KEY (\`organizationDepartmentId\`) REFERENCES \`organization_department\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_team\` ADD CONSTRAINT \`FK_104140c94e838a058a34b30a09c\` FOREIGN KEY (\`inviteId\`) REFERENCES \`invite\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_team\` ADD CONSTRAINT \`FK_1132ec0c3618e53fc8cf7ed6694\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_invoice\` ADD CONSTRAINT \`FK_5a07958d7c6253b311dbdc34ff8\` FOREIGN KEY (\`invoiceId\`) REFERENCES \`invoice\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_invoice\` ADD CONSTRAINT \`FK_0728fc2cc26e8802cbf41aaf274\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_merchant\` ADD CONSTRAINT \`FK_e7d60a4e9906d056a8966e279fd\` FOREIGN KEY (\`merchantId\`) REFERENCES \`merchant\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_merchant\` ADD CONSTRAINT \`FK_4af822b453c7d7d5f033e6ea16f\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_merchant\` ADD CONSTRAINT \`FK_812f0cfb560ac6dda0d1345765b\` FOREIGN KEY (\`merchantId\`) REFERENCES \`merchant\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_merchant\` ADD CONSTRAINT \`FK_a6bfc0dc6e5234e8e7ef698a36a\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_contact\` ADD CONSTRAINT \`FK_1fb664a63f20bea6a3f0b387713\` FOREIGN KEY (\`organizationContactId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_contact\` ADD CONSTRAINT \`FK_8a06f5aded97d1b5e81005e1216\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_contact_employee\` ADD CONSTRAINT \`FK_beffeb7f338fa98354948c07894\` FOREIGN KEY (\`organizationContactId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_contact_employee\` ADD CONSTRAINT \`FK_cd2bd8302bfb6093d0908c36dcb\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_department\` ADD CONSTRAINT \`FK_c2c9cd2ea533d5442de455fb3e1\` FOREIGN KEY (\`organizationDepartmentId\`) REFERENCES \`organization_department\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_department\` ADD CONSTRAINT \`FK_0eb285a6b1ac7e3d0a542e50a4b\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_department_employee\` ADD CONSTRAINT \`FK_c34e79a3aa682bbd3f0e8cf4c46\` FOREIGN KEY (\`organizationDepartmentId\`) REFERENCES \`organization_department\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_department_employee\` ADD CONSTRAINT \`FK_0d4f83695591ae3c98a0544ac8d\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_department\` ADD CONSTRAINT \`FK_c58533f9ba63f42fef682e1ee7c\` FOREIGN KEY (\`organizationDepartmentId\`) REFERENCES \`organization_department\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_department\` ADD CONSTRAINT \`FK_ef6e8d34b95dcb2b21d5de08a61\` FOREIGN KEY (\`candidateId\`) REFERENCES \`candidate\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_employment_type\` ADD CONSTRAINT \`FK_41a87d3cfa58c851bbf03ad4e8d\` FOREIGN KEY (\`organizationEmploymentTypeId\`) REFERENCES \`organization_employment_type\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_employment_type\` ADD CONSTRAINT \`FK_904a731b2ae6bc1aa52c8302a98\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_employment_type_employee\` ADD CONSTRAINT \`FK_3bfdb894d67e6a29aa95780bb47\` FOREIGN KEY (\`organizationEmploymentTypeId\`) REFERENCES \`organization_employment_type\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_employment_type_employee\` ADD CONSTRAINT \`FK_3ed17d3e624435e9f2ad71e0583\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_employment_type\` ADD CONSTRAINT \`FK_b4b51067c538f78b8585ef2a175\` FOREIGN KEY (\`organizationEmploymentTypeId\`) REFERENCES \`organization_employment_type\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_employment_type\` ADD CONSTRAINT \`FK_8c5db3a96baffba025729ebe869\` FOREIGN KEY (\`candidateId\`) REFERENCES \`candidate\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_position\` ADD CONSTRAINT \`FK_1f7e0230bc542d7037810203786\` FOREIGN KEY (\`organizationPositionId\`) REFERENCES \`organization_position\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_position\` ADD CONSTRAINT \`FK_c71c381e77b0543ed4023aeef79\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_project\` ADD CONSTRAINT \`FK_b69fa5d1b1d02cdbe301ea6b108\` FOREIGN KEY (\`organizationProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_project\` ADD CONSTRAINT \`FK_18be859b371e9159dfc2cecbe13\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_team\` ADD CONSTRAINT \`FK_7c31431ff2173c2c939a0aa036c\` FOREIGN KEY (\`organizationProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_team\` ADD CONSTRAINT \`FK_599a5f7f6c190822dcfdbbb6eb0\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_team\` ADD CONSTRAINT \`FK_4b5e0ca086e6124eeddf84252fc\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_team\` ADD CONSTRAINT \`FK_2382356b63c832a137079210bd1\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_tasks_task\` ADD CONSTRAINT \`FK_2a6fb43dc7e7aebcda95e32a107\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_tasks_task\` ADD CONSTRAINT \`FK_d15fbe1e1d9c1f56651d8d3831e\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_vendor\` ADD CONSTRAINT \`FK_7dde3307daf6d6dec1513ecc560\` FOREIGN KEY (\`organizationVendorId\`) REFERENCES \`organization_vendor\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_vendor\` ADD CONSTRAINT \`FK_f71369c1cb86ae9fd4d5452f9aa\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization\` ADD CONSTRAINT \`FK_7ca79ff010025397cf9f216bdeb\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization\` ADD CONSTRAINT \`FK_f5e70849adc6f2f81fcbccae77c\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_payment\` ADD CONSTRAINT \`FK_1fcb2a337ee905ab36c4aea3a3c\` FOREIGN KEY (\`paymentId\`) REFERENCES \`payment\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_payment\` ADD CONSTRAINT \`FK_e087c0540b5098d115b50d954cd\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_options_product_option\` ADD CONSTRAINT \`FK_526f0131260eec308a3bd2b61b6\` FOREIGN KEY (\`productVariantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_options_product_option\` ADD CONSTRAINT \`FK_e96a71affe63c97f7fa2f076dac\` FOREIGN KEY (\`productOptionId\`) REFERENCES \`product_option\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_product\` ADD CONSTRAINT \`FK_e516b4a2a1a8d4beda7217eeac6\` FOREIGN KEY (\`productId\`) REFERENCES \`product\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_product\` ADD CONSTRAINT \`FK_f75a28915b38d926902c0f85b24\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_gallery_item\` ADD CONSTRAINT \`FK_f7187fa710c6a5d22f461926378\` FOREIGN KEY (\`productId\`) REFERENCES \`product\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_gallery_item\` ADD CONSTRAINT \`FK_825848065557eac3678b164cee2\` FOREIGN KEY (\`imageAssetId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_proposal\` ADD CONSTRAINT \`FK_3f55851a03524e567594d507744\` FOREIGN KEY (\`proposalId\`) REFERENCES \`proposal\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_proposal\` ADD CONSTRAINT \`FK_451853704de278eef61a37fa7a6\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_request_approval\` ADD CONSTRAINT \`FK_74938a30181630c480b36e27d76\` FOREIGN KEY (\`requestApprovalId\`) REFERENCES \`request_approval\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_request_approval\` ADD CONSTRAINT \`FK_6c6576bff4b497a4975337fa5e3\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`skill_employee\` ADD CONSTRAINT \`FK_e699b50ca468e75bbd36913dccb\` FOREIGN KEY (\`skillId\`) REFERENCES \`skill\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`skill_employee\` ADD CONSTRAINT \`FK_760034f54e598d519b5f0c4ecee\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`skill_organization\` ADD CONSTRAINT \`FK_61593ade5fed9445738ddbe39c4\` FOREIGN KEY (\`skillId\`) REFERENCES \`skill\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`skill_organization\` ADD CONSTRAINT \`FK_b65cfda00c52e1fc26cc96e52ca\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_task\` ADD CONSTRAINT \`FK_4b4e8f61e866248f2ddf8ce181a\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_task\` ADD CONSTRAINT \`FK_bf7c34187a346f499e4dbc4b08b\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_employee\` ADD CONSTRAINT \`FK_790858593698e54cba501eb6908\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_employee\` ADD CONSTRAINT \`FK_f38b1bd46f8831704348003bbff\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_team\` ADD CONSTRAINT \`FK_47689f911b0cbb16c94a56a9c50\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`task_team\` ADD CONSTRAINT \`FK_0ef34c9f9d6dc8d14f1fbb10e86\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_time_logs\` ADD CONSTRAINT \`FK_63c61a88461ff5c115c3b6bcde5\` FOREIGN KEY (\`timeSlotId\`) REFERENCES \`time_slot\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_time_logs\` ADD CONSTRAINT \`FK_2fc2675c79cb3cbceb32bf2dc7a\` FOREIGN KEY (\`timeLogId\`) REFERENCES \`time_log\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_user\` ADD CONSTRAINT \`FK_6a58ed56a12604c076a8e0cfdaa\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_user\` ADD CONSTRAINT \`FK_e64a306f3215dbb99bbb26ca599\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_warehouse\` ADD CONSTRAINT \`FK_08385e1e045b83d25978568743f\` FOREIGN KEY (\`warehouseId\`) REFERENCES \`warehouse\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_warehouse\` ADD CONSTRAINT \`FK_3557d514afd3794d40128e05423\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`tag_warehouse\` DROP FOREIGN KEY \`FK_3557d514afd3794d40128e05423\``);
		await queryRunner.query(`ALTER TABLE \`tag_warehouse\` DROP FOREIGN KEY \`FK_08385e1e045b83d25978568743f\``);
		await queryRunner.query(`ALTER TABLE \`tag_user\` DROP FOREIGN KEY \`FK_e64a306f3215dbb99bbb26ca599\``);
		await queryRunner.query(`ALTER TABLE \`tag_user\` DROP FOREIGN KEY \`FK_6a58ed56a12604c076a8e0cfdaa\``);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_time_logs\` DROP FOREIGN KEY \`FK_2fc2675c79cb3cbceb32bf2dc7a\``
		);
		await queryRunner.query(
			`ALTER TABLE \`time_slot_time_logs\` DROP FOREIGN KEY \`FK_63c61a88461ff5c115c3b6bcde5\``
		);
		await queryRunner.query(`ALTER TABLE \`task_team\` DROP FOREIGN KEY \`FK_0ef34c9f9d6dc8d14f1fbb10e86\``);
		await queryRunner.query(`ALTER TABLE \`task_team\` DROP FOREIGN KEY \`FK_47689f911b0cbb16c94a56a9c50\``);
		await queryRunner.query(`ALTER TABLE \`task_employee\` DROP FOREIGN KEY \`FK_f38b1bd46f8831704348003bbff\``);
		await queryRunner.query(`ALTER TABLE \`task_employee\` DROP FOREIGN KEY \`FK_790858593698e54cba501eb6908\``);
		await queryRunner.query(`ALTER TABLE \`tag_task\` DROP FOREIGN KEY \`FK_bf7c34187a346f499e4dbc4b08b\``);
		await queryRunner.query(`ALTER TABLE \`tag_task\` DROP FOREIGN KEY \`FK_4b4e8f61e866248f2ddf8ce181a\``);
		await queryRunner.query(
			`ALTER TABLE \`skill_organization\` DROP FOREIGN KEY \`FK_b65cfda00c52e1fc26cc96e52ca\``
		);
		await queryRunner.query(
			`ALTER TABLE \`skill_organization\` DROP FOREIGN KEY \`FK_61593ade5fed9445738ddbe39c4\``
		);
		await queryRunner.query(`ALTER TABLE \`skill_employee\` DROP FOREIGN KEY \`FK_760034f54e598d519b5f0c4ecee\``);
		await queryRunner.query(`ALTER TABLE \`skill_employee\` DROP FOREIGN KEY \`FK_e699b50ca468e75bbd36913dccb\``);
		await queryRunner.query(
			`ALTER TABLE \`tag_request_approval\` DROP FOREIGN KEY \`FK_6c6576bff4b497a4975337fa5e3\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_request_approval\` DROP FOREIGN KEY \`FK_74938a30181630c480b36e27d76\``
		);
		await queryRunner.query(`ALTER TABLE \`tag_proposal\` DROP FOREIGN KEY \`FK_451853704de278eef61a37fa7a6\``);
		await queryRunner.query(`ALTER TABLE \`tag_proposal\` DROP FOREIGN KEY \`FK_3f55851a03524e567594d507744\``);
		await queryRunner.query(
			`ALTER TABLE \`product_gallery_item\` DROP FOREIGN KEY \`FK_825848065557eac3678b164cee2\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_gallery_item\` DROP FOREIGN KEY \`FK_f7187fa710c6a5d22f461926378\``
		);
		await queryRunner.query(`ALTER TABLE \`tag_product\` DROP FOREIGN KEY \`FK_f75a28915b38d926902c0f85b24\``);
		await queryRunner.query(`ALTER TABLE \`tag_product\` DROP FOREIGN KEY \`FK_e516b4a2a1a8d4beda7217eeac6\``);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_options_product_option\` DROP FOREIGN KEY \`FK_e96a71affe63c97f7fa2f076dac\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_options_product_option\` DROP FOREIGN KEY \`FK_526f0131260eec308a3bd2b61b6\``
		);
		await queryRunner.query(`ALTER TABLE \`tag_payment\` DROP FOREIGN KEY \`FK_e087c0540b5098d115b50d954cd\``);
		await queryRunner.query(`ALTER TABLE \`tag_payment\` DROP FOREIGN KEY \`FK_1fcb2a337ee905ab36c4aea3a3c\``);
		await queryRunner.query(`ALTER TABLE \`tag_organization\` DROP FOREIGN KEY \`FK_f5e70849adc6f2f81fcbccae77c\``);
		await queryRunner.query(`ALTER TABLE \`tag_organization\` DROP FOREIGN KEY \`FK_7ca79ff010025397cf9f216bdeb\``);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_vendor\` DROP FOREIGN KEY \`FK_f71369c1cb86ae9fd4d5452f9aa\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_vendor\` DROP FOREIGN KEY \`FK_7dde3307daf6d6dec1513ecc560\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_tasks_task\` DROP FOREIGN KEY \`FK_d15fbe1e1d9c1f56651d8d3831e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_tasks_task\` DROP FOREIGN KEY \`FK_2a6fb43dc7e7aebcda95e32a107\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_team\` DROP FOREIGN KEY \`FK_2382356b63c832a137079210bd1\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_team\` DROP FOREIGN KEY \`FK_4b5e0ca086e6124eeddf84252fc\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_team\` DROP FOREIGN KEY \`FK_599a5f7f6c190822dcfdbbb6eb0\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_team\` DROP FOREIGN KEY \`FK_7c31431ff2173c2c939a0aa036c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_project\` DROP FOREIGN KEY \`FK_18be859b371e9159dfc2cecbe13\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_project\` DROP FOREIGN KEY \`FK_b69fa5d1b1d02cdbe301ea6b108\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_position\` DROP FOREIGN KEY \`FK_c71c381e77b0543ed4023aeef79\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_position\` DROP FOREIGN KEY \`FK_1f7e0230bc542d7037810203786\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_employment_type\` DROP FOREIGN KEY \`FK_8c5db3a96baffba025729ebe869\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_employment_type\` DROP FOREIGN KEY \`FK_b4b51067c538f78b8585ef2a175\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_employment_type_employee\` DROP FOREIGN KEY \`FK_3ed17d3e624435e9f2ad71e0583\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_employment_type_employee\` DROP FOREIGN KEY \`FK_3bfdb894d67e6a29aa95780bb47\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_employment_type\` DROP FOREIGN KEY \`FK_904a731b2ae6bc1aa52c8302a98\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_employment_type\` DROP FOREIGN KEY \`FK_41a87d3cfa58c851bbf03ad4e8d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_department\` DROP FOREIGN KEY \`FK_ef6e8d34b95dcb2b21d5de08a61\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_department\` DROP FOREIGN KEY \`FK_c58533f9ba63f42fef682e1ee7c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_department_employee\` DROP FOREIGN KEY \`FK_0d4f83695591ae3c98a0544ac8d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_department_employee\` DROP FOREIGN KEY \`FK_c34e79a3aa682bbd3f0e8cf4c46\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_department\` DROP FOREIGN KEY \`FK_0eb285a6b1ac7e3d0a542e50a4b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_department\` DROP FOREIGN KEY \`FK_c2c9cd2ea533d5442de455fb3e1\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_contact_employee\` DROP FOREIGN KEY \`FK_cd2bd8302bfb6093d0908c36dcb\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_contact_employee\` DROP FOREIGN KEY \`FK_beffeb7f338fa98354948c07894\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_contact\` DROP FOREIGN KEY \`FK_8a06f5aded97d1b5e81005e1216\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_contact\` DROP FOREIGN KEY \`FK_1fb664a63f20bea6a3f0b387713\``
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_merchant\` DROP FOREIGN KEY \`FK_a6bfc0dc6e5234e8e7ef698a36a\``
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_merchant\` DROP FOREIGN KEY \`FK_812f0cfb560ac6dda0d1345765b\``
		);
		await queryRunner.query(`ALTER TABLE \`tag_merchant\` DROP FOREIGN KEY \`FK_4af822b453c7d7d5f033e6ea16f\``);
		await queryRunner.query(`ALTER TABLE \`tag_merchant\` DROP FOREIGN KEY \`FK_e7d60a4e9906d056a8966e279fd\``);
		await queryRunner.query(`ALTER TABLE \`tag_invoice\` DROP FOREIGN KEY \`FK_0728fc2cc26e8802cbf41aaf274\``);
		await queryRunner.query(`ALTER TABLE \`tag_invoice\` DROP FOREIGN KEY \`FK_5a07958d7c6253b311dbdc34ff8\``);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_team\` DROP FOREIGN KEY \`FK_1132ec0c3618e53fc8cf7ed6694\``
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_team\` DROP FOREIGN KEY \`FK_104140c94e838a058a34b30a09c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_department\` DROP FOREIGN KEY \`FK_fe2eea7a939442efde885303efd\``
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_department\` DROP FOREIGN KEY \`FK_0935b93b3498a0f98db1af71760\``
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_contact\` DROP FOREIGN KEY \`FK_c5a147ce2a0ec69ccc61149262d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_contact\` DROP FOREIGN KEY \`FK_a0c92b6393c7a13266003d552ef\``
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_project\` DROP FOREIGN KEY \`FK_f2806968dd846cb49fcdac195a0\``
		);
		await queryRunner.query(
			`ALTER TABLE \`invite_organization_project\` DROP FOREIGN KEY \`FK_020325728f0979a2822a8295653\``
		);
		await queryRunner.query(`ALTER TABLE \`tag_integration\` DROP FOREIGN KEY \`FK_0f19ad9872190b7a67a9652d5e1\``);
		await queryRunner.query(`ALTER TABLE \`tag_integration\` DROP FOREIGN KEY \`FK_c9a85b16615bc5c3035802adb04\``);
		await queryRunner.query(
			`ALTER TABLE \`integration_integration_type\` DROP FOREIGN KEY \`FK_8dd2062499a6c2a708ddd05650e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_integration_type\` DROP FOREIGN KEY \`FK_34c86921ee9b462bc5c7b61fad4\``
		);
		await queryRunner.query(`ALTER TABLE \`tag_income\` DROP FOREIGN KEY \`FK_00e2fd30761a36911648166044c\``);
		await queryRunner.query(`ALTER TABLE \`tag_income\` DROP FOREIGN KEY \`FK_55c9568ebe1c4addc3deb6922e5\``);
		await queryRunner.query(`ALTER TABLE \`tag_expense\` DROP FOREIGN KEY \`FK_8dcfbd0d960672fefe681bcba9c\``);
		await queryRunner.query(`ALTER TABLE \`tag_expense\` DROP FOREIGN KEY \`FK_6f1108552ea7a70a4d958b338cd\``);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_expense_category\` DROP FOREIGN KEY \`FK_727dbf5e1100023681e216d6a93\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_organization_expense_category\` DROP FOREIGN KEY \`FK_107a93f89c8f31f4386ae4b19d9\``
		);
		await queryRunner.query(`ALTER TABLE \`tag_event_type\` DROP FOREIGN KEY \`FK_34b8f471aac00eaec6f2830e5bb\``);
		await queryRunner.query(`ALTER TABLE \`tag_event_type\` DROP FOREIGN KEY \`FK_094af399a26d4a1d3ae17ea11e3\``);
		await queryRunner.query(`ALTER TABLE \`tag_equipment\` DROP FOREIGN KEY \`FK_0360b8197c2a38d6fe882cb1aff\``);
		await queryRunner.query(`ALTER TABLE \`tag_equipment\` DROP FOREIGN KEY \`FK_bb0062d51a75164fcb64041ee7d\``);
		await queryRunner.query(
			`ALTER TABLE \`equipment_shares_teams\` DROP FOREIGN KEY \`FK_7ccef49dd56c8c74daa8d12186b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_shares_teams\` DROP FOREIGN KEY \`FK_f84171695b7aedfc454483bcf21\``
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_shares_employees\` DROP FOREIGN KEY \`FK_57f6461f1a710f0f4abdcb8d0e6\``
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_shares_employees\` DROP FOREIGN KEY \`FK_8676224f55a965c53e4bb7cbf8f\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_tasks_task\` DROP FOREIGN KEY \`FK_6bbbe677c5fc5115916b4eccfb1\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_tasks_task\` DROP FOREIGN KEY \`FK_eae5eea1c6a3fcf4a2c95f1a5fe\``
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_request_employee\` DROP FOREIGN KEY \`FK_0a8cf0aacf95ce66e73e75a95cf\``
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_request_employee\` DROP FOREIGN KEY \`FK_cd312469204347b1210397770a1\``
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_policy_employee\` DROP FOREIGN KEY \`FK_0f823750ac5a7d899cc5d8d0402\``
		);
		await queryRunner.query(
			`ALTER TABLE \`time_off_policy_employee\` DROP FOREIGN KEY \`FK_c451f53f5a6cd97db94e1c9482d\``
		);
		await queryRunner.query(`ALTER TABLE \`tag_employee\` DROP FOREIGN KEY \`FK_b1ffe2a63a48b486e18dc59d1b7\``);
		await queryRunner.query(`ALTER TABLE \`tag_employee\` DROP FOREIGN KEY \`FK_e0ddfccfe9816681c410ebf2b9a\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_2ba868f42c2301075b7c141359e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_6b5b0c3d994f59d9c800922257f\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_employee_level\` DROP FOREIGN KEY \`FK_f3caf4cc158fe8b8e06578e7922\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_employee_level\` DROP FOREIGN KEY \`FK_b3565ff8073d4f66c46d27fe88e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` DROP FOREIGN KEY \`FK_68e75e49f06409fd385b4f87746\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` DROP FOREIGN KEY \`FK_7ae5b4d4bdec77971dab319f2e2\``
		);
		await queryRunner.query(`ALTER TABLE \`tag_candidate\` DROP FOREIGN KEY \`FK_7e0891bb331b08bd4abb6776b76\``);
		await queryRunner.query(`ALTER TABLE \`tag_candidate\` DROP FOREIGN KEY \`FK_34e4625cc9b010079f1b5758b36\``);
		await queryRunner.query(`ALTER TABLE \`changelog\` DROP FOREIGN KEY \`FK_c2037b621d2e8023898aee4ac74\``);
		await queryRunner.query(`ALTER TABLE \`changelog\` DROP FOREIGN KEY \`FK_744268ee0ec6073883267bc3b66\``);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_author\` DROP FOREIGN KEY \`FK_2d5ecab1f06b327bad545536143\``
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_author\` DROP FOREIGN KEY \`FK_8eb7e413257d7a26104f4e326fd\``
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_author\` DROP FOREIGN KEY \`FK_81558bb2bef673628d92540b4e4\``
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_author\` DROP FOREIGN KEY \`FK_1551e821871d9230cc0dafbbe58\``
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_article\` DROP FOREIGN KEY \`FK_66af194845635058239e794e1b9\``
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_article\` DROP FOREIGN KEY \`FK_3547f82f867489542ceae58a49e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`knowledge_base_article\` DROP FOREIGN KEY \`FK_06a9902fedc1f9dcdbaf14afb01\``
		);
		await queryRunner.query(`ALTER TABLE \`knowledge_base\` DROP FOREIGN KEY \`FK_ff979040ce93cbc60863d322ecd\``);
		await queryRunner.query(`ALTER TABLE \`knowledge_base\` DROP FOREIGN KEY \`FK_2ba72a9dec732a10e8c05bcdec1\``);
		await queryRunner.query(`ALTER TABLE \`knowledge_base\` DROP FOREIGN KEY \`FK_bcb30c9893f4c8d0c4e556b4ed3\``);
		await queryRunner.query(`ALTER TABLE \`warehouse\` DROP FOREIGN KEY \`FK_84594016a98da8b87e0f51cd931\``);
		await queryRunner.query(`ALTER TABLE \`warehouse\` DROP FOREIGN KEY \`FK_f502dc6d9802306f9d1584932b8\``);
		await queryRunner.query(`ALTER TABLE \`warehouse\` DROP FOREIGN KEY \`FK_f5735eafddabdb4b20f621a976a\``);
		await queryRunner.query(`ALTER TABLE \`warehouse\` DROP FOREIGN KEY \`FK_9b2f00761a6b1b77cb6289e3fff\``);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product_variant\` DROP FOREIGN KEY \`FK_617306cb3613dd8d59301ae16fd\``
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product_variant\` DROP FOREIGN KEY \`FK_a2f863689d1316810c41c1ea38e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product_variant\` DROP FOREIGN KEY \`FK_d5f4b64e6a80546fd6dd4ac3ed0\``
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product_variant\` DROP FOREIGN KEY \`FK_a1c4a97b928b547c3041d3ac1f6\``
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product\` DROP FOREIGN KEY \`FK_3f934c4772e7c7f2c66d7ea4e72\``
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product\` DROP FOREIGN KEY \`FK_a8c9aee14d47ec7b3f2ac429ebc\``
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product\` DROP FOREIGN KEY \`FK_c899e17322d11e1977832e8c656\``
		);
		await queryRunner.query(
			`ALTER TABLE \`warehouse_product\` DROP FOREIGN KEY \`FK_62573a939f834f2de343f98288c\``
		);
		await queryRunner.query(`ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_5e028298e103e1694147ada69e5\``);
		await queryRunner.query(`ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_c28e52f758e7bbc53828db92194\``);
		await queryRunner.query(`ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_685bf353c85f23b6f848e4dcded\``);
		await queryRunner.query(
			`ALTER TABLE \`user_organization\` DROP FOREIGN KEY \`FK_29c3c8cc3ea9db22e4a347f4b5a\``
		);
		await queryRunner.query(
			`ALTER TABLE \`user_organization\` DROP FOREIGN KEY \`FK_7143f31467178a6164a42426c15\``
		);
		await queryRunner.query(
			`ALTER TABLE \`user_organization\` DROP FOREIGN KEY \`FK_611e1392c8cc9b101e3ea7ad80c\``
		);
		await queryRunner.query(`ALTER TABLE \`timesheet\` DROP FOREIGN KEY \`FK_6c1f81934a3f597b3b1a17f5623\``);
		await queryRunner.query(`ALTER TABLE \`timesheet\` DROP FOREIGN KEY \`FK_8c8f821cb0fe0dd387491ea7d9e\``);
		await queryRunner.query(`ALTER TABLE \`timesheet\` DROP FOREIGN KEY \`FK_aca65a79fe0c1ec9e6a59022c54\``);
		await queryRunner.query(`ALTER TABLE \`timesheet\` DROP FOREIGN KEY \`FK_25b8df69c9b7f5752c6a6a6ef7f\``);
		await queryRunner.query(`ALTER TABLE \`time_slot_minute\` DROP FOREIGN KEY \`FK_9272701d3da8bd8507f316c9154\``);
		await queryRunner.query(`ALTER TABLE \`time_slot_minute\` DROP FOREIGN KEY \`FK_82c5edbd179359212f16f0d386a\``);
		await queryRunner.query(`ALTER TABLE \`time_slot_minute\` DROP FOREIGN KEY \`FK_c7f72cb68b22b8ab988158e4d26\``);
		await queryRunner.query(`ALTER TABLE \`time_slot\` DROP FOREIGN KEY \`FK_7913305b850c7afc89b6ed96a30\``);
		await queryRunner.query(`ALTER TABLE \`time_slot\` DROP FOREIGN KEY \`FK_b407841271245501dd1a8c75513\``);
		await queryRunner.query(`ALTER TABLE \`time_slot\` DROP FOREIGN KEY \`FK_b8284109257b5137256b5b3e848\``);
		await queryRunner.query(`ALTER TABLE \`time_log\` DROP FOREIGN KEY \`FK_18dcdf754396f0cb0308dc91f4c\``);
		await queryRunner.query(`ALTER TABLE \`time_log\` DROP FOREIGN KEY \`FK_d1e8f22c02c5e949453dde7f2d1\``);
		await queryRunner.query(`ALTER TABLE \`time_log\` DROP FOREIGN KEY \`FK_1ddf2da35e34378fd845d80a18b\``);
		await queryRunner.query(`ALTER TABLE \`time_log\` DROP FOREIGN KEY \`FK_54776f6f5fd3c13c3bc1fbfac5b\``);
		await queryRunner.query(`ALTER TABLE \`time_log\` DROP FOREIGN KEY \`FK_e65393bb52aa8275b1392c73f72\``);
		await queryRunner.query(`ALTER TABLE \`time_log\` DROP FOREIGN KEY \`FK_a89a849957e005bafb8e4220bc7\``);
		await queryRunner.query(`ALTER TABLE \`time_log\` DROP FOREIGN KEY \`FK_aed2d5cc5680fba9d387c7f931d\``);
		await queryRunner.query(`ALTER TABLE \`time_log\` DROP FOREIGN KEY \`FK_fa9018cb248ea0f3b2b30ef143b\``);
		await queryRunner.query(`ALTER TABLE \`screenshot\` DROP FOREIGN KEY \`FK_fa1896dc735403799311968f7ec\``);
		await queryRunner.query(`ALTER TABLE \`screenshot\` DROP FOREIGN KEY \`FK_5b594d02d98d5defcde323abe5b\``);
		await queryRunner.query(`ALTER TABLE \`screenshot\` DROP FOREIGN KEY \`FK_0951aacffe3f8d0cff54cf2f341\``);
		await queryRunner.query(`ALTER TABLE \`screenshot\` DROP FOREIGN KEY \`FK_235004f3dafac90692cd64d9158\``);
		await queryRunner.query(`ALTER TABLE \`activity\` DROP FOREIGN KEY \`FK_2743f8990fde12f9586287eb09f\``);
		await queryRunner.query(`ALTER TABLE \`activity\` DROP FOREIGN KEY \`FK_4e382caaf07ab0923b2e06bf918\``);
		await queryRunner.query(`ALTER TABLE \`activity\` DROP FOREIGN KEY \`FK_5a898f44fa31ef7916f0c38b016\``);
		await queryRunner.query(`ALTER TABLE \`activity\` DROP FOREIGN KEY \`FK_a6f74ae99d549932391f0f44609\``);
		await queryRunner.query(`ALTER TABLE \`activity\` DROP FOREIGN KEY \`FK_fdb3f018c2bba4885bfa5757d16\``);
		await queryRunner.query(`ALTER TABLE \`activity\` DROP FOREIGN KEY \`FK_f2401d8fdff5d8970dfe30d3aed\``);
		await queryRunner.query(`ALTER TABLE \`time_off_request\` DROP FOREIGN KEY \`FK_c009cdd795be674c20470623742\``);
		await queryRunner.query(`ALTER TABLE \`time_off_request\` DROP FOREIGN KEY \`FK_c1f8ae47dc2f1882afc5045c739\``);
		await queryRunner.query(`ALTER TABLE \`time_off_request\` DROP FOREIGN KEY \`FK_981333982a6df8b815957dcbf27\``);
		await queryRunner.query(`ALTER TABLE \`time_off_request\` DROP FOREIGN KEY \`FK_4989834dd1c9c8ea3576ed99ce5\``);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` DROP FOREIGN KEY \`FK_c2744cffeca55c3c9c52bb9789c\``);
		await queryRunner.query(`ALTER TABLE \`time_off_policy\` DROP FOREIGN KEY \`FK_1c0ed84d54f8fbe4af10dfcda1c\``);
		await queryRunner.query(`ALTER TABLE \`tenant\` DROP FOREIGN KEY \`FK_d154d06dac0d0e0a5d9a083e253\``);
		await queryRunner.query(`ALTER TABLE \`tenant_setting\` DROP FOREIGN KEY \`FK_affdab301e348b892175f30fa39\``);
		await queryRunner.query(`ALTER TABLE \`task_version\` DROP FOREIGN KEY \`FK_959e77718a2e76ee56498c1106a\``);
		await queryRunner.query(`ALTER TABLE \`task_version\` DROP FOREIGN KEY \`FK_91988120385964f213aec8aa84c\``);
		await queryRunner.query(`ALTER TABLE \`task_version\` DROP FOREIGN KEY \`FK_9c845f353378371ee3aa60f6865\``);
		await queryRunner.query(`ALTER TABLE \`task_version\` DROP FOREIGN KEY \`FK_379c8bd0ce203341148c1f99ee7\``);
		await queryRunner.query(`ALTER TABLE \`task_status\` DROP FOREIGN KEY \`FK_0330b4a942b536d8d1f264abe32\``);
		await queryRunner.query(`ALTER TABLE \`task_status\` DROP FOREIGN KEY \`FK_a19e8975e5c296640d457dfc11f\``);
		await queryRunner.query(`ALTER TABLE \`task_status\` DROP FOREIGN KEY \`FK_9b9a828a49f4bd6383a4073fe23\``);
		await queryRunner.query(`ALTER TABLE \`task_status\` DROP FOREIGN KEY \`FK_efbaf00a743316b394cc31e4a20\``);
		await queryRunner.query(`ALTER TABLE \`task_size\` DROP FOREIGN KEY \`FK_f4438327b3c2afb0832569b2a1e\``);
		await queryRunner.query(`ALTER TABLE \`task_size\` DROP FOREIGN KEY \`FK_ad6792b26526bd96ab18d634544\``);
		await queryRunner.query(`ALTER TABLE \`task_size\` DROP FOREIGN KEY \`FK_596512cc6508a482cc23ae6ab78\``);
		await queryRunner.query(`ALTER TABLE \`task_size\` DROP FOREIGN KEY \`FK_f6ec2207e50680a475d71c89793\``);
		await queryRunner.query(
			`ALTER TABLE \`task_related_issue_type\` DROP FOREIGN KEY \`FK_4967ebdca0aefb9d43e56695e42\``
		);
		await queryRunner.query(
			`ALTER TABLE \`task_related_issue_type\` DROP FOREIGN KEY \`FK_d99fe5b50dbe5078e0d9a9b6a9d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`task_related_issue_type\` DROP FOREIGN KEY \`FK_bed691e21fe01cf5aceee722952\``
		);
		await queryRunner.query(
			`ALTER TABLE \`task_related_issue_type\` DROP FOREIGN KEY \`FK_b7b0ea8ac2825fb981c1181d115\``
		);
		await queryRunner.query(`ALTER TABLE \`task_priority\` DROP FOREIGN KEY \`FK_52b039cff6a1adf6b7f9e49ee44\``);
		await queryRunner.query(`ALTER TABLE \`task_priority\` DROP FOREIGN KEY \`FK_db4237960ca989eb7a48cd433b1\``);
		await queryRunner.query(`ALTER TABLE \`task_priority\` DROP FOREIGN KEY \`FK_7fd1b30d159b608cbf59009f681\``);
		await queryRunner.query(`ALTER TABLE \`task_priority\` DROP FOREIGN KEY \`FK_1818655f27b8cf4f0d1dbfeb8db\``);
		await queryRunner.query(
			`ALTER TABLE \`task_linked_issues\` DROP FOREIGN KEY \`FK_0848fd2b8c23c0ab55146297cff\``
		);
		await queryRunner.query(
			`ALTER TABLE \`task_linked_issues\` DROP FOREIGN KEY \`FK_6deea7b3671e45973e191a1502c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`task_linked_issues\` DROP FOREIGN KEY \`FK_24114c4059e6b6991daba541b1d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`task_linked_issues\` DROP FOREIGN KEY \`FK_20b50abc5c97610a75d49ad3817\``
		);
		await queryRunner.query(`ALTER TABLE \`task\` DROP FOREIGN KEY \`FK_b8616deefe44d0622233e73fbf9\``);
		await queryRunner.query(`ALTER TABLE \`task\` DROP FOREIGN KEY \`FK_2f4bdd2593fd6038aaa91fd1076\``);
		await queryRunner.query(`ALTER TABLE \`task\` DROP FOREIGN KEY \`FK_0cbe714983eb0aae5feeee8212b\``);
		await queryRunner.query(`ALTER TABLE \`task\` DROP FOREIGN KEY \`FK_1e1f64696aa3a26d3e12c840e55\``);
		await queryRunner.query(`ALTER TABLE \`task\` DROP FOREIGN KEY \`FK_94fe6b3a5aec5f85427df4f8cd7\``);
		await queryRunner.query(`ALTER TABLE \`task\` DROP FOREIGN KEY \`FK_3797a20ef5553ae87af126bc2fe\``);
		await queryRunner.query(`ALTER TABLE \`task\` DROP FOREIGN KEY \`FK_8c9920b5fb32c3d8453f64b705c\``);
		await queryRunner.query(`ALTER TABLE \`task\` DROP FOREIGN KEY \`FK_5b0272d923a31c972bed1a1ac4d\``);
		await queryRunner.query(`ALTER TABLE \`task\` DROP FOREIGN KEY \`FK_e91cbff3d206f150ccc14d0c3a1\``);
		await queryRunner.query(`ALTER TABLE \`issue_type\` DROP FOREIGN KEY \`FK_586513cceb16777fd14a17bfe10\``);
		await queryRunner.query(`ALTER TABLE \`issue_type\` DROP FOREIGN KEY \`FK_131331557078611a68b4a5b2e7e\``);
		await queryRunner.query(`ALTER TABLE \`issue_type\` DROP FOREIGN KEY \`FK_33779b0395f72af0b50dc526d1d\``);
		await queryRunner.query(`ALTER TABLE \`issue_type\` DROP FOREIGN KEY \`FK_16dbef9d1b2b422abdce8ee3ae2\``);
		await queryRunner.query(`ALTER TABLE \`issue_type\` DROP FOREIGN KEY \`FK_8b12c913c39c72fe5980427c963\``);
		await queryRunner.query(`ALTER TABLE \`task_estimation\` DROP FOREIGN KEY \`FK_a3ee022203211f678376cd919bb\``);
		await queryRunner.query(`ALTER TABLE \`task_estimation\` DROP FOREIGN KEY \`FK_8f274646f2bdf4e12990feeb040\``);
		await queryRunner.query(`ALTER TABLE \`task_estimation\` DROP FOREIGN KEY \`FK_16507eb222e3c50be077fb4ace2\``);
		await queryRunner.query(`ALTER TABLE \`task_estimation\` DROP FOREIGN KEY \`FK_87bfea6d0b9a1ec602ee88e5f68\``);
		await queryRunner.query(`ALTER TABLE \`tag\` DROP FOREIGN KEY \`FK_49746602acc4e5e8721062b69ec\``);
		await queryRunner.query(`ALTER TABLE \`tag\` DROP FOREIGN KEY \`FK_c2f6bec0b39eaa3a6d90903ae99\``);
		await queryRunner.query(`ALTER TABLE \`tag\` DROP FOREIGN KEY \`FK_b08dd29fb6a8acdf83c83d8988f\``);
		await queryRunner.query(`ALTER TABLE \`skill\` DROP FOREIGN KEY \`FK_b2923d394f3636671ff9b3c3e81\``);
		await queryRunner.query(`ALTER TABLE \`skill\` DROP FOREIGN KEY \`FK_8e502eac7ed1347c71c26beae81\``);
		await queryRunner.query(`ALTER TABLE \`role\` DROP FOREIGN KEY \`FK_1751a572e91385a09d41c624714\``);
		await queryRunner.query(`ALTER TABLE \`role_permission\` DROP FOREIGN KEY \`FK_e3130a39c1e4a740d044e685730\``);
		await queryRunner.query(`ALTER TABLE \`role_permission\` DROP FOREIGN KEY \`FK_cbd053921056e77c0a8e03122af\``);
		await queryRunner.query(`ALTER TABLE \`request_approval\` DROP FOREIGN KEY \`FK_26bb3420001d31337393ed05bc3\``);
		await queryRunner.query(`ALTER TABLE \`request_approval\` DROP FOREIGN KEY \`FK_8343741e7929043b2a7de89f739\``);
		await queryRunner.query(`ALTER TABLE \`request_approval\` DROP FOREIGN KEY \`FK_9feaa23ed7bc47d51315e304bb5\``);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_team\` DROP FOREIGN KEY \`FK_9ccdaee6c5c62cda8f7375e8417\``
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_team\` DROP FOREIGN KEY \`FK_6c75d8a8c609e88896b2653cc41\``
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_team\` DROP FOREIGN KEY \`FK_77e1050669b32cfff482f960169\``
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_team\` DROP FOREIGN KEY \`FK_94b2a3d0f17c9549dea1493dc96\``
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_employee\` DROP FOREIGN KEY \`FK_ce2113039f070b3f003aa0db611\``
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_employee\` DROP FOREIGN KEY \`FK_563fec5539b89a57f40731f9858\``
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_employee\` DROP FOREIGN KEY \`FK_4071f027554eefff65ac8123e6e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`request_approval_employee\` DROP FOREIGN KEY \`FK_a5445b38b780b29b09369e36a9b\``
		);
		await queryRunner.query(`ALTER TABLE \`report\` DROP FOREIGN KEY \`FK_230652e48daa99c50c000fc5d10\``);
		await queryRunner.query(
			`ALTER TABLE \`report_organization\` DROP FOREIGN KEY \`FK_a085d6f9bcfd19f8bae1dbfe135\``
		);
		await queryRunner.query(
			`ALTER TABLE \`report_organization\` DROP FOREIGN KEY \`FK_5193788a3ebc1143bedb74cf725\``
		);
		await queryRunner.query(
			`ALTER TABLE \`report_organization\` DROP FOREIGN KEY \`FK_edf9bd011d7f08e3e18a5becb8b\``
		);
		await queryRunner.query(`ALTER TABLE \`proposal\` DROP FOREIGN KEY \`FK_61c45ab51852e4b0e539756d40f\``);
		await queryRunner.query(`ALTER TABLE \`proposal\` DROP FOREIGN KEY \`FK_f399488a0f3ea10bb511e3f5aa3\``);
		await queryRunner.query(`ALTER TABLE \`proposal\` DROP FOREIGN KEY \`FK_d59ec6899d435f430799795ad7b\``);
		await queryRunner.query(`ALTER TABLE \`proposal\` DROP FOREIGN KEY \`FK_4177329f5e6ddbfb64165927134\``);
		await queryRunner.query(
			`ALTER TABLE \`product_translation\` DROP FOREIGN KEY \`FK_d24bc28e54f1dc296452a255917\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_translation\` DROP FOREIGN KEY \`FK_e6abcacc3d3a4f9cf5ca97f2b28\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_translation\` DROP FOREIGN KEY \`FK_7533fd275bfb3219ce9eb4004c7\``
		);
		await queryRunner.query(`ALTER TABLE \`product\` DROP FOREIGN KEY \`FK_618194d24a7ea86a165d7ec628e\``);
		await queryRunner.query(`ALTER TABLE \`product\` DROP FOREIGN KEY \`FK_374bfd0d1b0e1398d7206456d98\``);
		await queryRunner.query(`ALTER TABLE \`product\` DROP FOREIGN KEY \`FK_4627873dbc1af07d732e6eec7be\``);
		await queryRunner.query(`ALTER TABLE \`product\` DROP FOREIGN KEY \`FK_32a4bdd261ec81f4ca6b3abe262\``);
		await queryRunner.query(`ALTER TABLE \`product\` DROP FOREIGN KEY \`FK_08293ca31a601d3cd0228120bc9\``);
		await queryRunner.query(`ALTER TABLE \`product_variant\` DROP FOREIGN KEY \`FK_b83f23626741630a86299607156\``);
		await queryRunner.query(`ALTER TABLE \`product_variant\` DROP FOREIGN KEY \`FK_6e420052844edf3a5506d863ce6\``);
		await queryRunner.query(`ALTER TABLE \`product_variant\` DROP FOREIGN KEY \`FK_9f0fd369dfeb275415c649d110b\``);
		await queryRunner.query(`ALTER TABLE \`product_variant\` DROP FOREIGN KEY \`FK_41b31a71dda350cfe5da07e0e4f\``);
		await queryRunner.query(`ALTER TABLE \`product_variant\` DROP FOREIGN KEY \`FK_6a289b10030ae86903406e3c9bd\``);
		await queryRunner.query(`ALTER TABLE \`product_variant\` DROP FOREIGN KEY \`FK_9121e00c4dc3500dc610cf8722e\``);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_price\` DROP FOREIGN KEY \`FK_5842f603bd85d924127d63d73cd\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_price\` DROP FOREIGN KEY \`FK_0cfba32db58a952f58b1e35cf1c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_price\` DROP FOREIGN KEY \`FK_7052eaf00a5795afa5ebf359950\``
		);
		await queryRunner.query(`ALTER TABLE \`product_type\` DROP FOREIGN KEY \`FK_e4e4120b0c19d3a207ce38d7581\``);
		await queryRunner.query(`ALTER TABLE \`product_type\` DROP FOREIGN KEY \`FK_f206c807fc7e41fc8a8b6679ae0\``);
		await queryRunner.query(
			`ALTER TABLE \`product_type_translation\` DROP FOREIGN KEY \`FK_f4b767c43b4e9130c63382c9b28\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_type_translation\` DROP FOREIGN KEY \`FK_2dd271bdeb602b8c3956287e33c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_type_translation\` DROP FOREIGN KEY \`FK_30aafca59cdb456bf5231f9e463\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_setting\` DROP FOREIGN KEY \`FK_b0d86990fe7160a5f3e4011fb23\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_setting\` DROP FOREIGN KEY \`FK_bed9d45e15866d9b8e87e7a7bfe\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_setting\` DROP FOREIGN KEY \`FK_2efe48435d4ba480a4bb8b96fa6\``
		);
		await queryRunner.query(`ALTER TABLE \`product_option\` DROP FOREIGN KEY \`FK_a6debf9198e2fbfa006aa10d710\``);
		await queryRunner.query(`ALTER TABLE \`product_option\` DROP FOREIGN KEY \`FK_47ffb82a65c43f102b7e0efa41a\``);
		await queryRunner.query(`ALTER TABLE \`product_option\` DROP FOREIGN KEY \`FK_985d235aa5394937c4493262c7f\``);
		await queryRunner.query(
			`ALTER TABLE \`product_option_translation\` DROP FOREIGN KEY \`FK_f43c46e12db0580af320db77381\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_translation\` DROP FOREIGN KEY \`FK_4dc2f466cfa3d0b7fef19d12731\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_translation\` DROP FOREIGN KEY \`FK_9869d7680f48487e584f5d2fca7\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_group_translation\` DROP FOREIGN KEY \`FK_c9ce1da98b6d93293daafee63aa\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_group_translation\` DROP FOREIGN KEY \`FK_0e2fcc31743e20a45fc3cf0211d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_group_translation\` DROP FOREIGN KEY \`FK_fd6b39f1fd1db026b5dcc3c7953\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_group\` DROP FOREIGN KEY \`FK_a6e91739227bf4d442f23c52c75\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_group\` DROP FOREIGN KEY \`FK_4a1430a01b71ecdfcd54b2b6c5c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_option_group\` DROP FOREIGN KEY \`FK_462a7fd3ce68935cf973c6709f9\``
		);
		await queryRunner.query(`ALTER TABLE \`product_category\` DROP FOREIGN KEY \`FK_f38e86bd280ff9c9c7d9cb78393\``);
		await queryRunner.query(`ALTER TABLE \`product_category\` DROP FOREIGN KEY \`FK_853302351eaa4daa39920c270a9\``);
		await queryRunner.query(`ALTER TABLE \`product_category\` DROP FOREIGN KEY \`FK_0a0cf25cd8232a154d1cce2641c\``);
		await queryRunner.query(
			`ALTER TABLE \`product_category_translation\` DROP FOREIGN KEY \`FK_586294149d24cd835678878ef12\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_category_translation\` DROP FOREIGN KEY \`FK_e46203bf1dbf3291d174f02cb34\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_category_translation\` DROP FOREIGN KEY \`FK_27d71aa2e843f07fbf36329be3f\``
		);
		await queryRunner.query(`ALTER TABLE \`pipeline\` DROP FOREIGN KEY \`FK_873ade98fbd6ca71c8b4d1bbcac\``);
		await queryRunner.query(`ALTER TABLE \`pipeline\` DROP FOREIGN KEY \`FK_683274c59fb08b21249096e305c\``);
		await queryRunner.query(`ALTER TABLE \`pipeline_stage\` DROP FOREIGN KEY \`FK_73ec3158bf224b485fd715cb3a6\``);
		await queryRunner.query(`ALTER TABLE \`pipeline_stage\` DROP FOREIGN KEY \`FK_04d16bdd72668de12c3e41a85a6\``);
		await queryRunner.query(`ALTER TABLE \`pipeline_stage\` DROP FOREIGN KEY \`FK_28965bf63ad4c0976892d0fd5e8\``);
		await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`FK_82753b9e315af84b20eaf84d778\``);
		await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`FK_8846e403ec45e1ad8c309f91a37\``);
		await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`FK_3f13c738eff604a85700746ec7d\``);
		await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`FK_87223c7f1d4c2ca51cf69927844\``);
		await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`FK_62ef561a3bb084a7d12dad8a2d9\``);
		await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`FK_be7fcc9fb8cd5a74cb602ec6c9b\``);
		await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`FK_6959c37c3acf0832103a2535703\``);
		await queryRunner.query(`ALTER TABLE \`password_reset\` DROP FOREIGN KEY \`FK_1fa632f2d12a06ef8dcc00858ff\``);
		await queryRunner.query(`ALTER TABLE \`organization\` DROP FOREIGN KEY \`FK_47b6a97e09895a06606a4a80421\``);
		await queryRunner.query(`ALTER TABLE \`organization\` DROP FOREIGN KEY \`FK_7965db2b12872551b586f76dd79\``);
		await queryRunner.query(`ALTER TABLE \`organization\` DROP FOREIGN KEY \`FK_745a293c8b2c750bc421fa06332\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_vendor\` DROP FOREIGN KEY \`FK_56dd132aa3743cfa9b034d020eb\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_vendor\` DROP FOREIGN KEY \`FK_7e0bf6063e1728c9813d5da7caa\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team\` DROP FOREIGN KEY \`FK_51e91be110fa0b8e70066f5727f\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team\` DROP FOREIGN KEY \`FK_da625f694eb1e23e585f3010082\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team\` DROP FOREIGN KEY \`FK_eef1c19a0cb5321223cfe3286c4\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team\` DROP FOREIGN KEY \`FK_176f5ed3c4534f3110d423d5690\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_join_request\` DROP FOREIGN KEY \`FK_171b852be7c1f387eca93775aad\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_join_request\` DROP FOREIGN KEY \`FK_5e73656ce0355347477c42ae19b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_join_request\` DROP FOREIGN KEY \`FK_c15823bf3f63b1fe331d9de6625\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_join_request\` DROP FOREIGN KEY \`FK_d9529008c733cb90044b8c2ad6b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_employee\` DROP FOREIGN KEY \`FK_ce83034f38496f5fe3f19796977\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_employee\` DROP FOREIGN KEY \`FK_a2a5601d799fbfc29c17b99243f\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_employee\` DROP FOREIGN KEY \`FK_8dc83cdd7c519d73afc0d8bdf09\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_employee\` DROP FOREIGN KEY \`FK_719aeb37fa7a1dd80d25336a0cf\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_employee\` DROP FOREIGN KEY \`FK_d8eba1c0e500c60be1b69c1e777\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_team_employee\` DROP FOREIGN KEY \`FK_fe12e1b76bbb76209134d9bdc2e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_task_setting\` DROP FOREIGN KEY \`FK_20a290f166c0810eafbf2717171\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_task_setting\` DROP FOREIGN KEY \`FK_19ab7adf33199bc6f913db277d7\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_task_setting\` DROP FOREIGN KEY \`FK_5830901876e426adfc15fb7341b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_task_setting\` DROP FOREIGN KEY \`FK_582768159ef0c749e8552ea9bcd\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint\` DROP FOREIGN KEY \`FK_a140b7e30ff3455551a0fd599fb\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint\` DROP FOREIGN KEY \`FK_8a1fe8afb3aa672bae5993fbe7d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_sprint\` DROP FOREIGN KEY \`FK_f57ad03c4e471bd8530494ea63d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_recurring_expense\` DROP FOREIGN KEY \`FK_8a12e7a0d47d3c6a6b35f7984e3\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_recurring_expense\` DROP FOREIGN KEY \`FK_0b19a287858af40661bd3eb7411\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` DROP FOREIGN KEY \`FK_063324fdceb51f7086e401ed2c9\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` DROP FOREIGN KEY \`FK_bc1e32c13683dbb16ada1c6da14\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` DROP FOREIGN KEY \`FK_904ae0b765faef6ba2db8b1e698\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` DROP FOREIGN KEY \`FK_9d8afc1e1e64d4b7d48dd2229d7\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` DROP FOREIGN KEY \`FK_7cf84e8b5775f349f81a1f3cc44\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_position\` DROP FOREIGN KEY \`FK_a0409e39f23ff6d418f2c03df58\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_position\` DROP FOREIGN KEY \`FK_a8f497b1006ec967964abb0d497\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_language\` DROP FOREIGN KEY \`FK_020516e74a57cb85d75381e841a\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_language\` DROP FOREIGN KEY \`FK_4513931e2d530f78d7144c8c7cd\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_language\` DROP FOREIGN KEY \`FK_225e476592214e32e117a85213c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_employment_type\` DROP FOREIGN KEY \`FK_a583cfe32f492f5ba99b7bb2050\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_employment_type\` DROP FOREIGN KEY \`FK_227b5bd9867287cbbeece8f6ba9\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_document\` DROP FOREIGN KEY \`FK_c129dee7d1cb84e01e69b5e2c66\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_document\` DROP FOREIGN KEY \`FK_1057ec001a4c6b258658143047a\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_document\` DROP FOREIGN KEY \`FK_4bc83945c022a862a33629ff1e1\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_department\` DROP FOREIGN KEY \`FK_c61a562a2379d1c0077fe7de332\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_department\` DROP FOREIGN KEY \`FK_b3644ff7cd65239e29d292a41d1\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_contact\` DROP FOREIGN KEY \`FK_8cfcdc6bc8fb55e273d9ace5fd5\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_contact\` DROP FOREIGN KEY \`FK_a86d2e378b953cb39261f457d26\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_contact\` DROP FOREIGN KEY \`FK_6200736cb4d3617b004e5b647ff\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_contact\` DROP FOREIGN KEY \`FK_e68c43e315ad3aaea4e99cf461d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_award\` DROP FOREIGN KEY \`FK_2e0d21aab892b5993abaac09bcd\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_award\` DROP FOREIGN KEY \`FK_af6423760433da72002a7f369eb\``
		);
		await queryRunner.query(`ALTER TABLE \`merchant\` DROP FOREIGN KEY \`FK_20acc3c3a6c900c6ef9fc681996\``);
		await queryRunner.query(`ALTER TABLE \`merchant\` DROP FOREIGN KEY \`FK_e03ddff05652be527e04abdc56f\``);
		await queryRunner.query(`ALTER TABLE \`merchant\` DROP FOREIGN KEY \`FK_d306a524b507f72fa8550aeffe4\``);
		await queryRunner.query(`ALTER TABLE \`merchant\` DROP FOREIGN KEY \`FK_533144d7ae94180235ea456625b\``);
		await queryRunner.query(`ALTER TABLE \`key_result\` DROP FOREIGN KEY \`FK_3e1d08761a717c1dd71fe67249b\``);
		await queryRunner.query(`ALTER TABLE \`key_result\` DROP FOREIGN KEY \`FK_4e1e975124c1d717814a4bb2ec8\``);
		await queryRunner.query(`ALTER TABLE \`key_result\` DROP FOREIGN KEY \`FK_d8547e21ccb8e37ac9f0d69c1af\``);
		await queryRunner.query(`ALTER TABLE \`key_result\` DROP FOREIGN KEY \`FK_38dc003f3484eff4b59918e9ae3\``);
		await queryRunner.query(`ALTER TABLE \`key_result\` DROP FOREIGN KEY \`FK_c89adeff0de3aedb2e772a5bf4c\``);
		await queryRunner.query(`ALTER TABLE \`key_result\` DROP FOREIGN KEY \`FK_5880347716f9ec5056ec15112cc\``);
		await queryRunner.query(`ALTER TABLE \`key_result\` DROP FOREIGN KEY \`FK_d1f45ca98f17bd84a5e430feaf4\``);
		await queryRunner.query(`ALTER TABLE \`key_result\` DROP FOREIGN KEY \`FK_8ac2c6b487d03157adda874789f\``);
		await queryRunner.query(
			`ALTER TABLE \`key_result_update\` DROP FOREIGN KEY \`FK_7497a70a581e5f56f792015dd37\``
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result_update\` DROP FOREIGN KEY \`FK_fd4b0cb7a44ed914acdda55e29c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result_update\` DROP FOREIGN KEY \`FK_cd9cbc0d5b6d62dbb63c3b3a65b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result_template\` DROP FOREIGN KEY \`FK_46426ea45456e240a092b732047\``
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result_template\` DROP FOREIGN KEY \`FK_4bc62c3d2ffdd6f9c7f8b3dcd1c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result_template\` DROP FOREIGN KEY \`FK_fab6b6200b9ed6fd002c1ff62ab\``
		);
		await queryRunner.query(
			`ALTER TABLE \`key_result_template\` DROP FOREIGN KEY \`FK_86c09eb673b0e66129dbdc72111\``
		);
		await queryRunner.query(`ALTER TABLE \`invoice\` DROP FOREIGN KEY \`FK_d9e965da0f63c94983d3a1006ac\``);
		await queryRunner.query(`ALTER TABLE \`invoice\` DROP FOREIGN KEY \`FK_b5c33892e630b66c65d623baf8e\``);
		await queryRunner.query(`ALTER TABLE \`invoice\` DROP FOREIGN KEY \`FK_058ef835f99e28fc6717cd7c80f\``);
		await queryRunner.query(`ALTER TABLE \`invoice\` DROP FOREIGN KEY \`FK_7fb52a5f267f53b7d93af3d8c3c\``);
		await queryRunner.query(`ALTER TABLE \`invoice_item\` DROP FOREIGN KEY \`FK_e558df60d7d9a3e412ef0bbb844\``);
		await queryRunner.query(`ALTER TABLE \`invoice_item\` DROP FOREIGN KEY \`FK_16f1d0e74b4d33e59c0eabdaac7\``);
		await queryRunner.query(`ALTER TABLE \`invoice_item\` DROP FOREIGN KEY \`FK_d4d92abde074b3da8054d7cfbc7\``);
		await queryRunner.query(`ALTER TABLE \`invoice_item\` DROP FOREIGN KEY \`FK_62d486728b272e3b4d23a6b5db6\``);
		await queryRunner.query(`ALTER TABLE \`invoice_item\` DROP FOREIGN KEY \`FK_553d5aac210d22fdca5c8d48ead\``);
		await queryRunner.query(`ALTER TABLE \`invoice_item\` DROP FOREIGN KEY \`FK_897c33b49a04cf3db7acd336afc\``);
		await queryRunner.query(`ALTER TABLE \`invoice_item\` DROP FOREIGN KEY \`FK_e89749c8e8258b2ec110c0776ff\``);
		await queryRunner.query(`ALTER TABLE \`invoice_item\` DROP FOREIGN KEY \`FK_f78214cd9de76e80fe8a6305f52\``);
		await queryRunner.query(
			`ALTER TABLE \`invoice_estimate_history\` DROP FOREIGN KEY \`FK_31ec3d5a6b0985cec544c642178\``
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_estimate_history\` DROP FOREIGN KEY \`FK_da2893697d57368470952a76f65\``
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_estimate_history\` DROP FOREIGN KEY \`FK_856f24297f120604f8ae2942769\``
		);
		await queryRunner.query(
			`ALTER TABLE \`invoice_estimate_history\` DROP FOREIGN KEY \`FK_cc0ac824ba89deda98bb418e8ca\``
		);
		await queryRunner.query(`ALTER TABLE \`invite\` DROP FOREIGN KEY \`FK_91bfeec7a9574f458e5b592472d\``);
		await queryRunner.query(`ALTER TABLE \`invite\` DROP FOREIGN KEY \`FK_900a3ed40499c79c1c289fec284\``);
		await queryRunner.query(`ALTER TABLE \`invite\` DROP FOREIGN KEY \`FK_5a182e8b3e225b14ddf6df7e6c3\``);
		await queryRunner.query(`ALTER TABLE \`invite\` DROP FOREIGN KEY \`FK_68eef4ab86b67747f24f288a16c\``);
		await queryRunner.query(`ALTER TABLE \`invite\` DROP FOREIGN KEY \`FK_7c2328f76efb850b81147972476\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository_issue\` DROP FOREIGN KEY \`FK_5065401113abb6e9608225e5678\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository_issue\` DROP FOREIGN KEY \`FK_6c8e119fc6a2a7d3413aa76d3bd\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository_issue\` DROP FOREIGN KEY \`FK_b3234be5b70c2362cdf67bb1889\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository\` DROP FOREIGN KEY \`FK_add7dbec156589dd0b27e2e0c49\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository\` DROP FOREIGN KEY \`FK_69d75a47af6bfcda545a865691b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository\` DROP FOREIGN KEY \`FK_480158f21938444e4f62fb31857\``
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_tenant\` DROP FOREIGN KEY \`FK_0d6ddc27d687ca879042c5f3ce3\``
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_tenant\` DROP FOREIGN KEY \`FK_33ab224e7755a46fff5bc1e64e5\``
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_tenant\` DROP FOREIGN KEY \`FK_24e37d03ef224f1a16a35069c2c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_setting\` DROP FOREIGN KEY \`FK_34daf030004ad37b88f1f3d863c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_setting\` DROP FOREIGN KEY \`FK_369eaafb13afe9903a170077edb\``
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_setting\` DROP FOREIGN KEY \`FK_954c6b05297814776d9cb66ca77\``
		);
		await queryRunner.query(`ALTER TABLE \`integration_map\` DROP FOREIGN KEY \`FK_c327ea26bda3d349a1eceb5658e\``);
		await queryRunner.query(`ALTER TABLE \`integration_map\` DROP FOREIGN KEY \`FK_7022dafd72c1b92f7d506914411\``);
		await queryRunner.query(`ALTER TABLE \`integration_map\` DROP FOREIGN KEY \`FK_eec3d6064578610ddc609dd360e\``);
		await queryRunner.query(
			`ALTER TABLE \`integration_entity_setting\` DROP FOREIGN KEY \`FK_f80ff4ebbf0b33a67dce5989117\``
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_entity_setting\` DROP FOREIGN KEY \`FK_c6c01e38eebd8b26b9214b90441\``
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_entity_setting\` DROP FOREIGN KEY \`FK_23e9cfcf1bfff07dcc3254378df\``
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_entity_setting_tied\` DROP FOREIGN KEY \`FK_3fb863167095805e33f38a0fdcc\``
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_entity_setting_tied\` DROP FOREIGN KEY \`FK_d5ac36aa3d5919908414154fca0\``
		);
		await queryRunner.query(
			`ALTER TABLE \`integration_entity_setting_tied\` DROP FOREIGN KEY \`FK_b208a754c7a538cb3422f39f5b9\``
		);
		await queryRunner.query(`ALTER TABLE \`income\` DROP FOREIGN KEY \`FK_29fbd3a17710a27e6f856072c01\``);
		await queryRunner.query(`ALTER TABLE \`income\` DROP FOREIGN KEY \`FK_a05d52b7ffe89140f9cbcf114b3\``);
		await queryRunner.query(`ALTER TABLE \`income\` DROP FOREIGN KEY \`FK_64409de4711cd14e2c43371cc02\``);
		await queryRunner.query(`ALTER TABLE \`income\` DROP FOREIGN KEY \`FK_8608b275644cfc7a0f3f5850814\``);
		await queryRunner.query(`ALTER TABLE \`image_asset\` DROP FOREIGN KEY \`FK_d3675304df9971cccf96d9a7c34\``);
		await queryRunner.query(`ALTER TABLE \`image_asset\` DROP FOREIGN KEY \`FK_01856a9a730b7e79d70aa661cb0\``);
		await queryRunner.query(`ALTER TABLE \`goal\` DROP FOREIGN KEY \`FK_4c8b4e887a994182fd6132e6400\``);
		await queryRunner.query(`ALTER TABLE \`goal\` DROP FOREIGN KEY \`FK_af0a11734e70412b742ac339c88\``);
		await queryRunner.query(`ALTER TABLE \`goal\` DROP FOREIGN KEY \`FK_35526ff1063ab5fa2b20e71bd66\``);
		await queryRunner.query(`ALTER TABLE \`goal\` DROP FOREIGN KEY \`FK_ac161c1a0c0ff8e83554f097e5e\``);
		await queryRunner.query(`ALTER TABLE \`goal\` DROP FOREIGN KEY \`FK_c6e8ae55a4db3584686cbf6afe1\``);
		await queryRunner.query(`ALTER TABLE \`goal\` DROP FOREIGN KEY \`FK_6b4758a5442713070c9a366d0e5\``);
		await queryRunner.query(`ALTER TABLE \`goal_time_frame\` DROP FOREIGN KEY \`FK_405bc5bba9ed71aefef84a29f10\``);
		await queryRunner.query(`ALTER TABLE \`goal_time_frame\` DROP FOREIGN KEY \`FK_b56723b53a76ca1c171890c479b\``);
		await queryRunner.query(`ALTER TABLE \`goal_template\` DROP FOREIGN KEY \`FK_5708fe06608c72fc77b65ae6519\``);
		await queryRunner.query(`ALTER TABLE \`goal_template\` DROP FOREIGN KEY \`FK_774bf82989475befe301fe1bca5\``);
		await queryRunner.query(`ALTER TABLE \`goal_kpi\` DROP FOREIGN KEY \`FK_d4f093ca4eb7c40db68d9a789d0\``);
		await queryRunner.query(`ALTER TABLE \`goal_kpi\` DROP FOREIGN KEY \`FK_e49e37fe88a2725a38a3b058493\``);
		await queryRunner.query(`ALTER TABLE \`goal_kpi\` DROP FOREIGN KEY \`FK_43aa2985216560cd9fa93f501e5\``);
		await queryRunner.query(
			`ALTER TABLE \`goal_kpi_template\` DROP FOREIGN KEY \`FK_f69e740b066c6469d1c68a4a28b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_kpi_template\` DROP FOREIGN KEY \`FK_df7ab026698c02859ff75408093\``
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_kpi_template\` DROP FOREIGN KEY \`FK_cc72d4e8e4284dcc8ffbf96caf4\``
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_general_setting\` DROP FOREIGN KEY \`FK_e35d0f7b794ca8850669d12c78c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`goal_general_setting\` DROP FOREIGN KEY \`FK_d17a5159d888ac6320459eda392\``
		);
		await queryRunner.query(`ALTER TABLE \`feature\` DROP FOREIGN KEY \`FK_d4a28a8e70d450a412bf0cfb52a\``);
		await queryRunner.query(
			`ALTER TABLE \`feature_organization\` DROP FOREIGN KEY \`FK_6d413f9fdd5366b1b9add464836\``
		);
		await queryRunner.query(
			`ALTER TABLE \`feature_organization\` DROP FOREIGN KEY \`FK_6a94e6b0a572f591288ac44a421\``
		);
		await queryRunner.query(
			`ALTER TABLE \`feature_organization\` DROP FOREIGN KEY \`FK_8f71803d96dcdbcc6b19bb28d38\``
		);
		await queryRunner.query(`ALTER TABLE \`import-record\` DROP FOREIGN KEY \`FK_a43b235c35c2c4d3263ada770c6\``);
		await queryRunner.query(`ALTER TABLE \`import-history\` DROP FOREIGN KEY \`FK_54868607115e2fee3b0b764eec2\``);
		await queryRunner.query(`ALTER TABLE \`expense\` DROP FOREIGN KEY \`FK_047b8b5c0782d5a6d4c8bfc1a4e\``);
		await queryRunner.query(`ALTER TABLE \`expense\` DROP FOREIGN KEY \`FK_9971c4171ae051e74b833984a30\``);
		await queryRunner.query(`ALTER TABLE \`expense\` DROP FOREIGN KEY \`FK_42eea5debc63f4d1bf89881c10a\``);
		await queryRunner.query(`ALTER TABLE \`expense\` DROP FOREIGN KEY \`FK_eacb116ab0521ad9b96f2bb53ba\``);
		await queryRunner.query(`ALTER TABLE \`expense\` DROP FOREIGN KEY \`FK_5e7b197dbac69012dbdb4964f37\``);
		await queryRunner.query(`ALTER TABLE \`expense\` DROP FOREIGN KEY \`FK_c5fb146726ff128e600f23d0a1b\``);
		await queryRunner.query(`ALTER TABLE \`expense\` DROP FOREIGN KEY \`FK_6d171c9d5f81095436b99da5e62\``);
		await queryRunner.query(`ALTER TABLE \`expense_category\` DROP FOREIGN KEY \`FK_9c9bfe5baaf83f53533ff035fc0\``);
		await queryRunner.query(`ALTER TABLE \`expense_category\` DROP FOREIGN KEY \`FK_37504e920ee5ca46a4000b89da5\``);
		await queryRunner.query(`ALTER TABLE \`event_type\` DROP FOREIGN KEY \`FK_24d905ec9e127ade23754a363dd\``);
		await queryRunner.query(`ALTER TABLE \`event_type\` DROP FOREIGN KEY \`FK_fc8818d6fde74370ec703a01352\``);
		await queryRunner.query(`ALTER TABLE \`event_type\` DROP FOREIGN KEY \`FK_92fc62260c0c7ff108622850bff\``);
		await queryRunner.query(`ALTER TABLE \`estimate_email\` DROP FOREIGN KEY \`FK_233c1d351d63441aeb039d1164f\``);
		await queryRunner.query(`ALTER TABLE \`estimate_email\` DROP FOREIGN KEY \`FK_391d3f83244fea73c619aecadd9\``);
		await queryRunner.query(`ALTER TABLE \`equipment\` DROP FOREIGN KEY \`FK_0ab80a66282582ae8b0282508e7\``);
		await queryRunner.query(`ALTER TABLE \`equipment\` DROP FOREIGN KEY \`FK_f98ce0d210aa9f91b729d447806\``);
		await queryRunner.query(`ALTER TABLE \`equipment\` DROP FOREIGN KEY \`FK_fb6808468066849ab7b7454d5f3\``);
		await queryRunner.query(
			`ALTER TABLE \`equipment_sharing\` DROP FOREIGN KEY \`FK_0ecfe0ce0cd2b197249d5f1c105\``
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_sharing\` DROP FOREIGN KEY \`FK_acad51a6362806fc499e583e402\``
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_sharing\` DROP FOREIGN KEY \`FK_ea9254be07ae4a8604f0aaab196\``
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_sharing\` DROP FOREIGN KEY \`FK_fa525e61fb3d8d9efec0f364a4b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_sharing_policy\` DROP FOREIGN KEY \`FK_5311a833ff255881454bd5b3b58\``
		);
		await queryRunner.query(
			`ALTER TABLE \`equipment_sharing_policy\` DROP FOREIGN KEY \`FK_5443ca8ed830626656d8cfecef7\``
		);
		await queryRunner.query(`ALTER TABLE \`employee\` DROP FOREIGN KEY \`FK_5e719204dcafa8d6b2ecdeda130\``);
		await queryRunner.query(`ALTER TABLE \`employee\` DROP FOREIGN KEY \`FK_1c0c1370ecd98040259625e17e2\``);
		await queryRunner.query(`ALTER TABLE \`employee\` DROP FOREIGN KEY \`FK_f4b0d329c4a3cf79ffe9d565047\``);
		await queryRunner.query(`ALTER TABLE \`employee\` DROP FOREIGN KEY \`FK_c6a48286f3aa8ae903bee0d1e72\``);
		await queryRunner.query(`ALTER TABLE \`employee\` DROP FOREIGN KEY \`FK_4b3303a6b7eb92d237a4379734e\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP FOREIGN KEY \`FK_95ea18af6ef8123503d332240c2\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP FOREIGN KEY \`FK_56e96cd218a185ed59b5a8e7869\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP FOREIGN KEY \`FK_9516a627a131626d2a5738a05a8\``);
		await queryRunner.query(
			`ALTER TABLE \`employee_recurring_expense\` DROP FOREIGN KEY \`FK_0ac8526c48a3daa267c86225fb5\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recurring_expense\` DROP FOREIGN KEY \`FK_3ee5147bb1fde625fa33c0e956b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_recurring_expense\` DROP FOREIGN KEY \`FK_5fde7be40b3c03bc0fdac0c2f66\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_proposal_template\` DROP FOREIGN KEY \`FK_2be728a7f8b118712a4200990d4\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_proposal_template\` DROP FOREIGN KEY \`FK_ee780fbd8f91de31c004929eecb\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_proposal_template\` DROP FOREIGN KEY \`FK_f577c9bc6183c1d1eae1e154bbc\``
		);
		await queryRunner.query(`ALTER TABLE \`employee_phone\` DROP FOREIGN KEY \`FK_329ebd01a757d1a0c3c4d628e29\``);
		await queryRunner.query(`ALTER TABLE \`employee_phone\` DROP FOREIGN KEY \`FK_0f9cefa604913e1ab3225915469\``);
		await queryRunner.query(`ALTER TABLE \`employee_phone\` DROP FOREIGN KEY \`FK_d543336994b1f764c449e0b1d3c\``);
		await queryRunner.query(`ALTER TABLE \`employee_level\` DROP FOREIGN KEY \`FK_c4668533292bf4526e61aedf74a\``);
		await queryRunner.query(`ALTER TABLE \`employee_level\` DROP FOREIGN KEY \`FK_d3fc52d497bc44d6f493dbedc3a\``);
		await queryRunner.query(
			`ALTER TABLE \`job_search_occupation\` DROP FOREIGN KEY \`FK_1a62a99e1016e4a2b461e886ecd\``
		);
		await queryRunner.query(
			`ALTER TABLE \`job_search_occupation\` DROP FOREIGN KEY \`FK_44e22d88b47daf2095491b7cac3\``
		);
		await queryRunner.query(
			`ALTER TABLE \`job_search_category\` DROP FOREIGN KEY \`FK_86381fb6d28978b101b3aec8ca4\``
		);
		await queryRunner.query(
			`ALTER TABLE \`job_search_category\` DROP FOREIGN KEY \`FK_35e120f2b6e5188391cf068d3ba\``
		);
		await queryRunner.query(`ALTER TABLE \`job_preset\` DROP FOREIGN KEY \`FK_a4b038417e3221c0791dd8c7714\``);
		await queryRunner.query(`ALTER TABLE \`job_preset\` DROP FOREIGN KEY \`FK_7e53ea80aca15da11a8a5ec0380\``);
		await queryRunner.query(
			`ALTER TABLE \`job_preset_upwork_job_search_criterion\` DROP FOREIGN KEY \`FK_b909a3df761d7e489aca80f138a\``
		);
		await queryRunner.query(
			`ALTER TABLE \`job_preset_upwork_job_search_criterion\` DROP FOREIGN KEY \`FK_d45b36b85ffbd5189f7e70f29f5\``
		);
		await queryRunner.query(
			`ALTER TABLE \`job_preset_upwork_job_search_criterion\` DROP FOREIGN KEY \`FK_9a687ce1a10a3abda460922cf84\``
		);
		await queryRunner.query(
			`ALTER TABLE \`job_preset_upwork_job_search_criterion\` DROP FOREIGN KEY \`FK_d5ca48cfacfb516543d6507ca4a\``
		);
		await queryRunner.query(
			`ALTER TABLE \`job_preset_upwork_job_search_criterion\` DROP FOREIGN KEY \`FK_2323220b4decfd2f4d8307fd78f\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_upwork_job_search_criterion\` DROP FOREIGN KEY \`FK_d2b148ddd67e520fb8061f4c133\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_upwork_job_search_criterion\` DROP FOREIGN KEY \`FK_b6bcd5ceb60e4bb493344a6b4f2\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_upwork_job_search_criterion\` DROP FOREIGN KEY \`FK_c872e6e3ab28e813c2324d1f4fb\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_upwork_job_search_criterion\` DROP FOREIGN KEY \`FK_2dc73e07ac7040f273cea3c999d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_upwork_job_search_criterion\` DROP FOREIGN KEY \`FK_630337302efe97cc93deeb21516\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_upwork_job_search_criterion\` DROP FOREIGN KEY \`FK_afe6c40d3d9951388fa05f83f28\``
		);
		await queryRunner.query(`ALTER TABLE \`employee_award\` DROP FOREIGN KEY \`FK_0c5266f3f488add404f92d56ec7\``);
		await queryRunner.query(`ALTER TABLE \`employee_award\` DROP FOREIGN KEY \`FK_caf8363b0ed7d5f24ae866ba3bb\``);
		await queryRunner.query(`ALTER TABLE \`employee_award\` DROP FOREIGN KEY \`FK_91e0f7efcd17d20b5029fb1342d\``);
		await queryRunner.query(
			`ALTER TABLE \`employee_appointment\` DROP FOREIGN KEY \`FK_2f58132c57108540887dc3e88eb\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_appointment\` DROP FOREIGN KEY \`FK_86cf36c137712e779dd7e2301e6\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_appointment\` DROP FOREIGN KEY \`FK_a35637bb659c59e18adb4f38f87\``
		);
		await queryRunner.query(`ALTER TABLE \`email_template\` DROP FOREIGN KEY \`FK_c160fe6234675fac031aa3e7c50\``);
		await queryRunner.query(`ALTER TABLE \`email_template\` DROP FOREIGN KEY \`FK_753e005a45556b5909e11937aaf\``);
		await queryRunner.query(`ALTER TABLE \`email_reset\` DROP FOREIGN KEY \`FK_e37af4ab2ba0bf268bfd9826345\``);
		await queryRunner.query(`ALTER TABLE \`email_reset\` DROP FOREIGN KEY \`FK_93799dfaeff51de06f1e02ac414\``);
		await queryRunner.query(`ALTER TABLE \`email_sent\` DROP FOREIGN KEY \`FK_9033faf41b23c61ba201c487969\``);
		await queryRunner.query(`ALTER TABLE \`email_sent\` DROP FOREIGN KEY \`FK_1261c457b3035b77719556995bf\``);
		await queryRunner.query(`ALTER TABLE \`email_sent\` DROP FOREIGN KEY \`FK_525f4873c6edc3d94559f88900c\``);
		await queryRunner.query(`ALTER TABLE \`email_sent\` DROP FOREIGN KEY \`FK_0af511c44de7a16beb45cc37852\``);
		await queryRunner.query(`ALTER TABLE \`deal\` DROP FOREIGN KEY \`FK_1ae3abc0ae1dcf6c13f49b62b56\``);
		await queryRunner.query(`ALTER TABLE \`deal\` DROP FOREIGN KEY \`FK_9211f5b62988df6e95522be7daa\``);
		await queryRunner.query(`ALTER TABLE \`deal\` DROP FOREIGN KEY \`FK_4b1ff44e6bae5065429dbab554b\``);
		await queryRunner.query(`ALTER TABLE \`deal\` DROP FOREIGN KEY \`FK_38fb85abdf9995efcf217f59554\``);
		await queryRunner.query(`ALTER TABLE \`deal\` DROP FOREIGN KEY \`FK_46a3c00bfc3e36b4412d8bcdb08\``);
		await queryRunner.query(`ALTER TABLE \`custom_smtp\` DROP FOREIGN KEY \`FK_15a1306132d66c63ef31f7288c1\``);
		await queryRunner.query(`ALTER TABLE \`custom_smtp\` DROP FOREIGN KEY \`FK_2aa3fc8daa25beec4788d2be26c\``);
		await queryRunner.query(`ALTER TABLE \`contact\` DROP FOREIGN KEY \`FK_7719d73cd16a9f57ecc6ac24b3d\``);
		await queryRunner.query(`ALTER TABLE \`contact\` DROP FOREIGN KEY \`FK_60468af1ce34043a900809c84f2\``);
		await queryRunner.query(`ALTER TABLE \`candidate\` DROP FOREIGN KEY \`FK_8b900e8a39f76125e610ab30c0e\``);
		await queryRunner.query(`ALTER TABLE \`candidate\` DROP FOREIGN KEY \`FK_3930aa71e0fa24f09201811b1bb\``);
		await queryRunner.query(`ALTER TABLE \`candidate\` DROP FOREIGN KEY \`FK_4ea108fd8b089237964d5f98fba\``);
		await queryRunner.query(`ALTER TABLE \`candidate\` DROP FOREIGN KEY \`FK_1e3e8228e7df634fa4cec6322c7\``);
		await queryRunner.query(`ALTER TABLE \`candidate\` DROP FOREIGN KEY \`FK_b674793a804b7d69d74c8f6c5ba\``);
		await queryRunner.query(`ALTER TABLE \`candidate\` DROP FOREIGN KEY \`FK_16fb27ffd1a99c6506c92ad57a7\``);
		await queryRunner.query(`ALTER TABLE \`candidate\` DROP FOREIGN KEY \`FK_77ac426e04553ff1654421bce4d\``);
		await queryRunner.query(
			`ALTER TABLE \`candidate_technology\` DROP FOREIGN KEY \`FK_063663c7e61e45d172d1b832656\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_technology\` DROP FOREIGN KEY \`FK_9d46b8c5382acd4d4514bc5c62e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_technology\` DROP FOREIGN KEY \`FK_a6fecb615b07987b480defac647\``
		);
		await queryRunner.query(`ALTER TABLE \`candidate_source\` DROP FOREIGN KEY \`FK_e92027b5280828cadd7cd6ea719\``);
		await queryRunner.query(`ALTER TABLE \`candidate_source\` DROP FOREIGN KEY \`FK_b2a1ba27a76dd819cd8294cce38\``);
		await queryRunner.query(`ALTER TABLE \`candidate_skill\` DROP FOREIGN KEY \`FK_492548e6c176f5655adfae9f5ea\``);
		await queryRunner.query(`ALTER TABLE \`candidate_skill\` DROP FOREIGN KEY \`FK_d7986743e7f11720349a6c95572\``);
		await queryRunner.query(`ALTER TABLE \`candidate_skill\` DROP FOREIGN KEY \`FK_8a07f780c6fce2b82830ab06877\``);
		await queryRunner.query(
			`ALTER TABLE \`candidate_personal_quality\` DROP FOREIGN KEY \`FK_a0d171f45bdbcf2b990c0c37c32\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_personal_quality\` DROP FOREIGN KEY \`FK_d321f4547ed467d07cce1e7d9a5\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_personal_quality\` DROP FOREIGN KEY \`FK_045de7c208adcd0c68c0a651748\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interviewer\` DROP FOREIGN KEY \`FK_9e7b20eb3dfa082b83b198fdad4\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interviewer\` DROP FOREIGN KEY \`FK_ecb65075e94b47bbab11cfa5a1e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interviewer\` DROP FOREIGN KEY \`FK_5f1e315db848990dfffa72817ca\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interviewer\` DROP FOREIGN KEY \`FK_f0ca69c78eea92c95d9044764a2\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interview\` DROP FOREIGN KEY \`FK_91996439c4baafee8395d3df153\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interview\` DROP FOREIGN KEY \`FK_03be41e88b1fecfe4e24d6b04b2\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_interview\` DROP FOREIGN KEY \`FK_59b765e6d13d83dba4852a43eb5\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_feedback\` DROP FOREIGN KEY \`FK_44f3d80c3293e1de038c87f115d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_feedback\` DROP FOREIGN KEY \`FK_0862c274d336126b951bfe009a7\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_feedback\` DROP FOREIGN KEY \`FK_98c008fd8cf597e83dcdccfd161\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_feedback\` DROP FOREIGN KEY \`FK_3a6928f8501fce33820721a8fe8\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_feedback\` DROP FOREIGN KEY \`FK_6cb21fa0f65ff69679966c836f2\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_experience\` DROP FOREIGN KEY \`FK_cf75465b3663652a28cf1841ce2\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_experience\` DROP FOREIGN KEY \`FK_a50eb955f940ca93e044d175c62\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_experience\` DROP FOREIGN KEY \`FK_8dcf5fc8bc7f77a80b0fc648bfc\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_education\` DROP FOREIGN KEY \`FK_59b61ba52a58851cfc85b1e6c66\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_education\` DROP FOREIGN KEY \`FK_f660af89b2c69fea2334508cbbd\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_education\` DROP FOREIGN KEY \`FK_00cdd9ed7571be8e2c8d09e7cd4\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_document\` DROP FOREIGN KEY \`FK_3f9053719c9d11ebdea03e5a2d4\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_document\` DROP FOREIGN KEY \`FK_d108a827199fda86a9ec216989a\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_document\` DROP FOREIGN KEY \`FK_4d9b7ab09f9f9517d488b5fed1e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_criterion_rating\` DROP FOREIGN KEY \`FK_159f821dd214792f1d2ad9cff7c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_criterion_rating\` DROP FOREIGN KEY \`FK_ba4c376b2069aa82745d4e96822\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_criterion_rating\` DROP FOREIGN KEY \`FK_d1d16bc87d3afaf387f34cdceb7\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_criterion_rating\` DROP FOREIGN KEY \`FK_b106406e94bb7317493efc2c989\``
		);
		await queryRunner.query(
			`ALTER TABLE \`candidate_criterion_rating\` DROP FOREIGN KEY \`FK_9d5bd131452ef689df2b46551b4\``
		);
		await queryRunner.query(
			`ALTER TABLE \`availability_slot\` DROP FOREIGN KEY \`FK_46ed3c2287423f5dc089100feeb\``
		);
		await queryRunner.query(
			`ALTER TABLE \`availability_slot\` DROP FOREIGN KEY \`FK_d544bd3a63634a4438509ac958d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`availability_slot\` DROP FOREIGN KEY \`FK_f008a481cb4eed547704bb9d839\``
		);
		await queryRunner.query(`ALTER TABLE \`approval_policy\` DROP FOREIGN KEY \`FK_dfe3b357df3ce136917b1f09843\``);
		await queryRunner.query(`ALTER TABLE \`approval_policy\` DROP FOREIGN KEY \`FK_1462391059ebe137645098d7276\``);
		await queryRunner.query(
			`ALTER TABLE \`appointment_employee\` DROP FOREIGN KEY \`FK_e9ca170a0fae05e44a9bd137d8b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`appointment_employee\` DROP FOREIGN KEY \`FK_0ddc50b7521b9a905d9ca8c8ba3\``
		);
		await queryRunner.query(
			`ALTER TABLE \`appointment_employee\` DROP FOREIGN KEY \`FK_3c3a62226896345c4716bfe1d96\``
		);
		await queryRunner.query(
			`ALTER TABLE \`appointment_employee\` DROP FOREIGN KEY \`FK_2c0494466d5a7e1165cea3dca98\``
		);
		await queryRunner.query(
			`ALTER TABLE \`accounting_template\` DROP FOREIGN KEY \`FK_e66511b175393255c6c4e7b007f\``
		);
		await queryRunner.query(
			`ALTER TABLE \`accounting_template\` DROP FOREIGN KEY \`FK_2ca6a49062a4ed884e413bf572e\``
		);
		await queryRunner.query(`DROP INDEX \`IDX_3557d514afd3794d40128e0542\` ON \`tag_warehouse\``);
		await queryRunner.query(`DROP INDEX \`IDX_08385e1e045b83d25978568743\` ON \`tag_warehouse\``);
		await queryRunner.query(`DROP TABLE \`tag_warehouse\``);
		await queryRunner.query(`DROP INDEX \`IDX_e64a306f3215dbb99bbb26ca59\` ON \`tag_user\``);
		await queryRunner.query(`DROP INDEX \`IDX_6a58ed56a12604c076a8e0cfda\` ON \`tag_user\``);
		await queryRunner.query(`DROP TABLE \`tag_user\``);
		await queryRunner.query(`DROP INDEX \`IDX_2fc2675c79cb3cbceb32bf2dc7\` ON \`time_slot_time_logs\``);
		await queryRunner.query(`DROP INDEX \`IDX_63c61a88461ff5c115c3b6bcde\` ON \`time_slot_time_logs\``);
		await queryRunner.query(`DROP TABLE \`time_slot_time_logs\``);
		await queryRunner.query(`DROP INDEX \`IDX_0ef34c9f9d6dc8d14f1fbb10e8\` ON \`task_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_47689f911b0cbb16c94a56a9c5\` ON \`task_team\``);
		await queryRunner.query(`DROP TABLE \`task_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_f38b1bd46f8831704348003bbf\` ON \`task_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_790858593698e54cba501eb690\` ON \`task_employee\``);
		await queryRunner.query(`DROP TABLE \`task_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_bf7c34187a346f499e4dbc4b08\` ON \`tag_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_4b4e8f61e866248f2ddf8ce181\` ON \`tag_task\``);
		await queryRunner.query(`DROP TABLE \`tag_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_b65cfda00c52e1fc26cc96e52c\` ON \`skill_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_61593ade5fed9445738ddbe39c\` ON \`skill_organization\``);
		await queryRunner.query(`DROP TABLE \`skill_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_760034f54e598d519b5f0c4ece\` ON \`skill_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_e699b50ca468e75bbd36913dcc\` ON \`skill_employee\``);
		await queryRunner.query(`DROP TABLE \`skill_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_6c6576bff4b497a4975337fa5e\` ON \`tag_request_approval\``);
		await queryRunner.query(`DROP INDEX \`IDX_74938a30181630c480b36e27d7\` ON \`tag_request_approval\``);
		await queryRunner.query(`DROP TABLE \`tag_request_approval\``);
		await queryRunner.query(`DROP INDEX \`IDX_451853704de278eef61a37fa7a\` ON \`tag_proposal\``);
		await queryRunner.query(`DROP INDEX \`IDX_3f55851a03524e567594d50774\` ON \`tag_proposal\``);
		await queryRunner.query(`DROP TABLE \`tag_proposal\``);
		await queryRunner.query(`DROP INDEX \`IDX_825848065557eac3678b164cee\` ON \`product_gallery_item\``);
		await queryRunner.query(`DROP INDEX \`IDX_f7187fa710c6a5d22f46192637\` ON \`product_gallery_item\``);
		await queryRunner.query(`DROP TABLE \`product_gallery_item\``);
		await queryRunner.query(`DROP INDEX \`IDX_f75a28915b38d926902c0f85b2\` ON \`tag_product\``);
		await queryRunner.query(`DROP INDEX \`IDX_e516b4a2a1a8d4beda7217eeac\` ON \`tag_product\``);
		await queryRunner.query(`DROP TABLE \`tag_product\``);
		await queryRunner.query(
			`DROP INDEX \`IDX_e96a71affe63c97f7fa2f076da\` ON \`product_variant_options_product_option\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_526f0131260eec308a3bd2b61b\` ON \`product_variant_options_product_option\``
		);
		await queryRunner.query(`DROP TABLE \`product_variant_options_product_option\``);
		await queryRunner.query(`DROP INDEX \`IDX_e087c0540b5098d115b50d954c\` ON \`tag_payment\``);
		await queryRunner.query(`DROP INDEX \`IDX_1fcb2a337ee905ab36c4aea3a3\` ON \`tag_payment\``);
		await queryRunner.query(`DROP TABLE \`tag_payment\``);
		await queryRunner.query(`DROP INDEX \`IDX_f5e70849adc6f2f81fcbccae77\` ON \`tag_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_7ca79ff010025397cf9f216bde\` ON \`tag_organization\``);
		await queryRunner.query(`DROP TABLE \`tag_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_f71369c1cb86ae9fd4d5452f9a\` ON \`tag_organization_vendor\``);
		await queryRunner.query(`DROP INDEX \`IDX_7dde3307daf6d6dec1513ecc56\` ON \`tag_organization_vendor\``);
		await queryRunner.query(`DROP TABLE \`tag_organization_vendor\``);
		await queryRunner.query(`DROP INDEX \`IDX_d15fbe1e1d9c1f56651d8d3831\` ON \`organization_team_tasks_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_2a6fb43dc7e7aebcda95e32a10\` ON \`organization_team_tasks_task\``);
		await queryRunner.query(`DROP TABLE \`organization_team_tasks_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_2382356b63c832a137079210bd\` ON \`tag_organization_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_4b5e0ca086e6124eeddf84252f\` ON \`tag_organization_team\``);
		await queryRunner.query(`DROP TABLE \`tag_organization_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_599a5f7f6c190822dcfdbbb6eb\` ON \`organization_project_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_7c31431ff2173c2c939a0aa036\` ON \`organization_project_team\``);
		await queryRunner.query(`DROP TABLE \`organization_project_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_18be859b371e9159dfc2cecbe1\` ON \`tag_organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_b69fa5d1b1d02cdbe301ea6b10\` ON \`tag_organization_project\``);
		await queryRunner.query(`DROP TABLE \`tag_organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_c71c381e77b0543ed4023aeef7\` ON \`tag_organization_position\``);
		await queryRunner.query(`DROP INDEX \`IDX_1f7e0230bc542d703781020378\` ON \`tag_organization_position\``);
		await queryRunner.query(`DROP TABLE \`tag_organization_position\``);
		await queryRunner.query(`DROP INDEX \`IDX_8c5db3a96baffba025729ebe86\` ON \`candidate_employment_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_b4b51067c538f78b8585ef2a17\` ON \`candidate_employment_type\``);
		await queryRunner.query(`DROP TABLE \`candidate_employment_type\``);
		await queryRunner.query(
			`DROP INDEX \`IDX_3ed17d3e624435e9f2ad71e058\` ON \`organization_employment_type_employee\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_3bfdb894d67e6a29aa95780bb4\` ON \`organization_employment_type_employee\``
		);
		await queryRunner.query(`DROP TABLE \`organization_employment_type_employee\``);
		await queryRunner.query(
			`DROP INDEX \`IDX_904a731b2ae6bc1aa52c8302a9\` ON \`tag_organization_employment_type\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_41a87d3cfa58c851bbf03ad4e8\` ON \`tag_organization_employment_type\``
		);
		await queryRunner.query(`DROP TABLE \`tag_organization_employment_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_ef6e8d34b95dcb2b21d5de08a6\` ON \`candidate_department\``);
		await queryRunner.query(`DROP INDEX \`IDX_c58533f9ba63f42fef682e1ee7\` ON \`candidate_department\``);
		await queryRunner.query(`DROP TABLE \`candidate_department\``);
		await queryRunner.query(
			`DROP INDEX \`IDX_0d4f83695591ae3c98a0544ac8\` ON \`organization_department_employee\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_c34e79a3aa682bbd3f0e8cf4c4\` ON \`organization_department_employee\``
		);
		await queryRunner.query(`DROP TABLE \`organization_department_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_0eb285a6b1ac7e3d0a542e50a4\` ON \`tag_organization_department\``);
		await queryRunner.query(`DROP INDEX \`IDX_c2c9cd2ea533d5442de455fb3e\` ON \`tag_organization_department\``);
		await queryRunner.query(`DROP TABLE \`tag_organization_department\``);
		await queryRunner.query(`DROP INDEX \`IDX_cd2bd8302bfb6093d0908c36dc\` ON \`organization_contact_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_beffeb7f338fa98354948c0789\` ON \`organization_contact_employee\``);
		await queryRunner.query(`DROP TABLE \`organization_contact_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_8a06f5aded97d1b5e81005e121\` ON \`tag_organization_contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_1fb664a63f20bea6a3f0b38771\` ON \`tag_organization_contact\``);
		await queryRunner.query(`DROP TABLE \`tag_organization_contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_a6bfc0dc6e5234e8e7ef698a36\` ON \`warehouse_merchant\``);
		await queryRunner.query(`DROP INDEX \`IDX_812f0cfb560ac6dda0d1345765\` ON \`warehouse_merchant\``);
		await queryRunner.query(`DROP TABLE \`warehouse_merchant\``);
		await queryRunner.query(`DROP INDEX \`IDX_4af822b453c7d7d5f033e6ea16\` ON \`tag_merchant\``);
		await queryRunner.query(`DROP INDEX \`IDX_e7d60a4e9906d056a8966e279f\` ON \`tag_merchant\``);
		await queryRunner.query(`DROP TABLE \`tag_merchant\``);
		await queryRunner.query(`DROP INDEX \`IDX_0728fc2cc26e8802cbf41aaf27\` ON \`tag_invoice\``);
		await queryRunner.query(`DROP INDEX \`IDX_5a07958d7c6253b311dbdc34ff\` ON \`tag_invoice\``);
		await queryRunner.query(`DROP TABLE \`tag_invoice\``);
		await queryRunner.query(`DROP INDEX \`IDX_1132ec0c3618e53fc8cf7ed669\` ON \`invite_organization_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_104140c94e838a058a34b30a09\` ON \`invite_organization_team\``);
		await queryRunner.query(`DROP TABLE \`invite_organization_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_fe2eea7a939442efde885303ef\` ON \`invite_organization_department\``);
		await queryRunner.query(`DROP INDEX \`IDX_0935b93b3498a0f98db1af7176\` ON \`invite_organization_department\``);
		await queryRunner.query(`DROP TABLE \`invite_organization_department\``);
		await queryRunner.query(`DROP INDEX \`IDX_c5a147ce2a0ec69ccc61149262\` ON \`invite_organization_contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_a0c92b6393c7a13266003d552e\` ON \`invite_organization_contact\``);
		await queryRunner.query(`DROP TABLE \`invite_organization_contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_f2806968dd846cb49fcdac195a\` ON \`invite_organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_020325728f0979a2822a829565\` ON \`invite_organization_project\``);
		await queryRunner.query(`DROP TABLE \`invite_organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_0f19ad9872190b7a67a9652d5e\` ON \`tag_integration\``);
		await queryRunner.query(`DROP INDEX \`IDX_c9a85b16615bc5c3035802adb0\` ON \`tag_integration\``);
		await queryRunner.query(`DROP TABLE \`tag_integration\``);
		await queryRunner.query(`DROP INDEX \`IDX_8dd2062499a6c2a708ddd05650\` ON \`integration_integration_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_34c86921ee9b462bc5c7b61fad\` ON \`integration_integration_type\``);
		await queryRunner.query(`DROP TABLE \`integration_integration_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_00e2fd30761a36911648166044\` ON \`tag_income\``);
		await queryRunner.query(`DROP INDEX \`IDX_55c9568ebe1c4addc3deb6922e\` ON \`tag_income\``);
		await queryRunner.query(`DROP TABLE \`tag_income\``);
		await queryRunner.query(`DROP INDEX \`IDX_8dcfbd0d960672fefe681bcba9\` ON \`tag_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_6f1108552ea7a70a4d958b338c\` ON \`tag_expense\``);
		await queryRunner.query(`DROP TABLE \`tag_expense\``);
		await queryRunner.query(
			`DROP INDEX \`IDX_727dbf5e1100023681e216d6a9\` ON \`tag_organization_expense_category\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_107a93f89c8f31f4386ae4b19d\` ON \`tag_organization_expense_category\``
		);
		await queryRunner.query(`DROP TABLE \`tag_organization_expense_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_34b8f471aac00eaec6f2830e5b\` ON \`tag_event_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_094af399a26d4a1d3ae17ea11e\` ON \`tag_event_type\``);
		await queryRunner.query(`DROP TABLE \`tag_event_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_0360b8197c2a38d6fe882cb1af\` ON \`tag_equipment\``);
		await queryRunner.query(`DROP INDEX \`IDX_bb0062d51a75164fcb64041ee7\` ON \`tag_equipment\``);
		await queryRunner.query(`DROP TABLE \`tag_equipment\``);
		await queryRunner.query(`DROP INDEX \`IDX_7ccef49dd56c8c74daa8d12186\` ON \`equipment_shares_teams\``);
		await queryRunner.query(`DROP INDEX \`IDX_f84171695b7aedfc454483bcf2\` ON \`equipment_shares_teams\``);
		await queryRunner.query(`DROP TABLE \`equipment_shares_teams\``);
		await queryRunner.query(`DROP INDEX \`IDX_57f6461f1a710f0f4abdcb8d0e\` ON \`equipment_shares_employees\``);
		await queryRunner.query(`DROP INDEX \`IDX_8676224f55a965c53e4bb7cbf8\` ON \`equipment_shares_employees\``);
		await queryRunner.query(`DROP TABLE \`equipment_shares_employees\``);
		await queryRunner.query(`DROP INDEX \`IDX_6bbbe677c5fc5115916b4eccfb\` ON \`employee_tasks_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_eae5eea1c6a3fcf4a2c95f1a5f\` ON \`employee_tasks_task\``);
		await queryRunner.query(`DROP TABLE \`employee_tasks_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_0a8cf0aacf95ce66e73e75a95c\` ON \`time_off_request_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_cd312469204347b1210397770a\` ON \`time_off_request_employee\``);
		await queryRunner.query(`DROP TABLE \`time_off_request_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_0f823750ac5a7d899cc5d8d040\` ON \`time_off_policy_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_c451f53f5a6cd97db94e1c9482\` ON \`time_off_policy_employee\``);
		await queryRunner.query(`DROP TABLE \`time_off_policy_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_b1ffe2a63a48b486e18dc59d1b\` ON \`tag_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_e0ddfccfe9816681c410ebf2b9\` ON \`tag_employee\``);
		await queryRunner.query(`DROP TABLE \`tag_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_2ba868f42c2301075b7c141359\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_6b5b0c3d994f59d9c800922257\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP TABLE \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_f3caf4cc158fe8b8e06578e792\` ON \`tag_employee_level\``);
		await queryRunner.query(`DROP INDEX \`IDX_b3565ff8073d4f66c46d27fe88\` ON \`tag_employee_level\``);
		await queryRunner.query(`DROP TABLE \`tag_employee_level\``);
		await queryRunner.query(`DROP INDEX \`IDX_68e75e49f06409fd385b4f8774\` ON \`employee_job_preset\``);
		await queryRunner.query(`DROP INDEX \`IDX_7ae5b4d4bdec77971dab319f2e\` ON \`employee_job_preset\``);
		await queryRunner.query(`DROP TABLE \`employee_job_preset\``);
		await queryRunner.query(`DROP INDEX \`IDX_7e0891bb331b08bd4abb6776b7\` ON \`tag_candidate\``);
		await queryRunner.query(`DROP INDEX \`IDX_34e4625cc9b010079f1b5758b3\` ON \`tag_candidate\``);
		await queryRunner.query(`DROP TABLE \`tag_candidate\``);
		await queryRunner.query(`DROP INDEX \`IDX_c2037b621d2e8023898aee4ac7\` ON \`changelog\``);
		await queryRunner.query(`DROP INDEX \`IDX_744268ee0ec6073883267bc3b6\` ON \`changelog\``);
		await queryRunner.query(`DROP INDEX \`IDX_cbc2b8338d45e774afd8682ffe\` ON \`changelog\``);
		await queryRunner.query(`DROP INDEX \`IDX_cc89233c87fcf64b01df07e038\` ON \`changelog\``);
		await queryRunner.query(`DROP TABLE \`changelog\``);
		await queryRunner.query(`DROP INDEX \`IDX_2d5ecab1f06b327bad54553614\` ON \`knowledge_base_author\``);
		await queryRunner.query(`DROP INDEX \`IDX_8eb7e413257d7a26104f4e326f\` ON \`knowledge_base_author\``);
		await queryRunner.query(`DROP INDEX \`IDX_81558bb2bef673628d92540b4e\` ON \`knowledge_base_author\``);
		await queryRunner.query(`DROP INDEX \`IDX_1551e821871d9230cc0dafbbe5\` ON \`knowledge_base_author\``);
		await queryRunner.query(`DROP INDEX \`IDX_a9130ad7824fb843f06103971e\` ON \`knowledge_base_author\``);
		await queryRunner.query(`DROP INDEX \`IDX_b9623984c84eb7be4c0eb076c2\` ON \`knowledge_base_author\``);
		await queryRunner.query(`DROP TABLE \`knowledge_base_author\``);
		await queryRunner.query(`DROP INDEX \`IDX_66af194845635058239e794e1b\` ON \`knowledge_base_article\``);
		await queryRunner.query(`DROP INDEX \`IDX_3547f82f867489542ceae58a49\` ON \`knowledge_base_article\``);
		await queryRunner.query(`DROP INDEX \`IDX_06a9902fedc1f9dcdbaf14afb0\` ON \`knowledge_base_article\``);
		await queryRunner.query(`DROP INDEX \`IDX_e9720156c57ff1ad841e95ace7\` ON \`knowledge_base_article\``);
		await queryRunner.query(`DROP INDEX \`IDX_1544c43e36e1ccf7d578c70607\` ON \`knowledge_base_article\``);
		await queryRunner.query(`DROP TABLE \`knowledge_base_article\``);
		await queryRunner.query(`DROP INDEX \`IDX_ff979040ce93cbc60863d322ec\` ON \`knowledge_base\``);
		await queryRunner.query(`DROP INDEX \`IDX_2ba72a9dec732a10e8c05bcdec\` ON \`knowledge_base\``);
		await queryRunner.query(`DROP INDEX \`IDX_bcb30c9893f4c8d0c4e556b4ed\` ON \`knowledge_base\``);
		await queryRunner.query(`DROP INDEX \`IDX_0765098c5a6f93f51a55bda026\` ON \`knowledge_base\``);
		await queryRunner.query(`DROP INDEX \`IDX_9b22423b8cb20087c16613ecba\` ON \`knowledge_base\``);
		await queryRunner.query(`DROP TABLE \`knowledge_base\``);
		await queryRunner.query(`DROP INDEX \`REL_84594016a98da8b87e0f51cd93\` ON \`warehouse\``);
		await queryRunner.query(`DROP INDEX \`IDX_84594016a98da8b87e0f51cd93\` ON \`warehouse\``);
		await queryRunner.query(`DROP INDEX \`IDX_f502dc6d9802306f9d1584932b\` ON \`warehouse\``);
		await queryRunner.query(`DROP INDEX \`IDX_f5735eafddabdb4b20f621a976\` ON \`warehouse\``);
		await queryRunner.query(`DROP INDEX \`IDX_9b2f00761a6b1b77cb6289e3ff\` ON \`warehouse\``);
		await queryRunner.query(`DROP INDEX \`IDX_835691d3dd62d0b705302cbb2d\` ON \`warehouse\``);
		await queryRunner.query(`DROP INDEX \`IDX_ee85901ae866ffe2061d5b35c8\` ON \`warehouse\``);
		await queryRunner.query(`DROP TABLE \`warehouse\``);
		await queryRunner.query(`DROP INDEX \`IDX_617306cb3613dd8d59301ae16f\` ON \`warehouse_product_variant\``);
		await queryRunner.query(`DROP INDEX \`IDX_a2f863689d1316810c41c1ea38\` ON \`warehouse_product_variant\``);
		await queryRunner.query(`DROP INDEX \`IDX_d5f4b64e6a80546fd6dd4ac3ed\` ON \`warehouse_product_variant\``);
		await queryRunner.query(`DROP INDEX \`IDX_a1c4a97b928b547c3041d3ac1f\` ON \`warehouse_product_variant\``);
		await queryRunner.query(`DROP INDEX \`IDX_40aa52eaed1ce133f5fee76bca\` ON \`warehouse_product_variant\``);
		await queryRunner.query(`DROP INDEX \`IDX_5f32a52e9bd19bf323b02efcd1\` ON \`warehouse_product_variant\``);
		await queryRunner.query(`DROP TABLE \`warehouse_product_variant\``);
		await queryRunner.query(`DROP INDEX \`IDX_3f934c4772e7c7f2c66d7ea4e7\` ON \`warehouse_product\``);
		await queryRunner.query(`DROP INDEX \`IDX_a8c9aee14d47ec7b3f2ac429eb\` ON \`warehouse_product\``);
		await queryRunner.query(`DROP INDEX \`IDX_c899e17322d11e1977832e8c65\` ON \`warehouse_product\``);
		await queryRunner.query(`DROP INDEX \`IDX_62573a939f834f2de343f98288\` ON \`warehouse_product\``);
		await queryRunner.query(`DROP INDEX \`IDX_3370818c940a51996d80bb4d16\` ON \`warehouse_product\``);
		await queryRunner.query(`DROP INDEX \`IDX_7a584a02d15a022e9c4f06ea72\` ON \`warehouse_product\``);
		await queryRunner.query(`DROP TABLE \`warehouse_product\``);
		await queryRunner.query(`DROP INDEX \`IDX_5e028298e103e1694147ada69e\` ON \`user\``);
		await queryRunner.query(`DROP INDEX \`IDX_c28e52f758e7bbc53828db9219\` ON \`user\``);
		await queryRunner.query(`DROP INDEX \`IDX_78a916df40e02a9deb1c4b75ed\` ON \`user\``);
		await queryRunner.query(`DROP INDEX \`IDX_f2578043e491921209f5dadd08\` ON \`user\``);
		await queryRunner.query(`DROP INDEX \`IDX_e12875dfb3b1d92d7d7c5377e2\` ON \`user\``);
		await queryRunner.query(`DROP INDEX \`IDX_f0e1b4ecdca13b177e2e3a0613\` ON \`user\``);
		await queryRunner.query(`DROP INDEX \`IDX_58e4dbff0e1a32a9bdc861bb29\` ON \`user\``);
		await queryRunner.query(`DROP INDEX \`IDX_19de43e9f1842360ce646253d7\` ON \`user\``);
		await queryRunner.query(`DROP INDEX \`IDX_685bf353c85f23b6f848e4dcde\` ON \`user\``);
		await queryRunner.query(`DROP INDEX \`IDX_557cb712d32a9ad9ffbb4cd50d\` ON \`user\``);
		await queryRunner.query(`DROP INDEX \`IDX_fde2ce12ab12b02ae583dd76c7\` ON \`user\``);
		await queryRunner.query(`DROP TABLE \`user\``);
		await queryRunner.query(`DROP INDEX \`IDX_29c3c8cc3ea9db22e4a347f4b5\` ON \`user_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_1f97ff07fb198bd0a7786b2abd\` ON \`user_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_7143f31467178a6164a42426c1\` ON \`user_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_611e1392c8cc9b101e3ea7ad80\` ON \`user_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_c764336019c69cc4927f317cb0\` ON \`user_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_ca24fc59aac015d9660955f5f6\` ON \`user_organization\``);
		await queryRunner.query(`DROP TABLE \`user_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_6c1f81934a3f597b3b1a17f562\` ON \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_8c8f821cb0fe0dd387491ea7d9\` ON \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_23fdffa8369387d87101090684\` ON \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_c828facbb4250117f83416d9f7\` ON \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_ea81b5247ecdf5d82cf71fa096\` ON \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_3502c60f98a7cda58dea75bcb5\` ON \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_3f8fc4b5718fcaa913f9438e27\` ON \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_6a79eb7534066b11f59243ede1\` ON \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_f6558fbb3158ab90da1c41d943\` ON \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_930e2b28de9ecb1ea689d5a97a\` ON \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_aca65a79fe0c1ec9e6a59022c5\` ON \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_25b8df69c9b7f5752c6a6a6ef7\` ON \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_f2d4cd3a7e839bfc7cb6b993ff\` ON \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_42205a9e6af108364e5cc62dd4\` ON \`timesheet\``);
		await queryRunner.query(`DROP TABLE \`timesheet\``);
		await queryRunner.query(`DROP INDEX \`IDX_0ac1d2777eefcee82db52ca366\` ON \`time_slot_minute\``);
		await queryRunner.query(`DROP INDEX \`IDX_9272701d3da8bd8507f316c915\` ON \`time_slot_minute\``);
		await queryRunner.query(`DROP INDEX \`IDX_82c5edbd179359212f16f0d386\` ON \`time_slot_minute\``);
		await queryRunner.query(`DROP INDEX \`IDX_c7f72cb68b22b8ab988158e4d2\` ON \`time_slot_minute\``);
		await queryRunner.query(`DROP INDEX \`IDX_a3eeb9629f550c367bb752855e\` ON \`time_slot_minute\``);
		await queryRunner.query(`DROP INDEX \`IDX_8260fdc7862ca27d8cf10e6290\` ON \`time_slot_minute\``);
		await queryRunner.query(`DROP TABLE \`time_slot_minute\``);
		await queryRunner.query(`DROP INDEX \`IDX_7913305b850c7afc89b6ed96a3\` ON \`time_slot\``);
		await queryRunner.query(`DROP INDEX \`IDX_c6e7d1075bfd97eea6643b1479\` ON \`time_slot\``);
		await queryRunner.query(`DROP INDEX \`IDX_f44e721669d5c6bed32cd6a3bf\` ON \`time_slot\``);
		await queryRunner.query(`DROP INDEX \`IDX_0c707825a7c2ecc4e186b07ebf\` ON \`time_slot\``);
		await queryRunner.query(`DROP INDEX \`IDX_b407841271245501dd1a8c7551\` ON \`time_slot\``);
		await queryRunner.query(`DROP INDEX \`IDX_b8284109257b5137256b5b3e84\` ON \`time_slot\``);
		await queryRunner.query(`DROP INDEX \`IDX_81060c5dbe69efa1f3b6e1a2e5\` ON \`time_slot\``);
		await queryRunner.query(`DROP INDEX \`IDX_645a6bc3f1141d4a111a3166d8\` ON \`time_slot\``);
		await queryRunner.query(`DROP TABLE \`time_slot\``);
		await queryRunner.query(`DROP INDEX \`IDX_18dcdf754396f0cb0308dc91f4\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_d1e8f22c02c5e949453dde7f2d\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_1ddf2da35e34378fd845d80a18\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_54776f6f5fd3c13c3bc1fbfac5\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_e65393bb52aa8275b1392c73f7\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_a89a849957e005bafb8e4220bc\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_79001d281ecb766005b3d331c1\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_f447474d185cd70b3015853874\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_722b9cb3a991c964d86396b6bc\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_402290e7045e0c10ef97d9f982\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_e80fb588b1086ce2a4f2244814\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_154e9120e2acb632d8bd9b91ff\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_a1f8fcd70164d915fe7dd4a1ec\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_189b79acd611870aba62b3594e\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_aed2d5cc5680fba9d387c7f931\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_fa9018cb248ea0f3b2b30ef143\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_91a64228fbbe1516730a0cab5d\` ON \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_a1910a76044b971609b75ea165\` ON \`time_log\``);
		await queryRunner.query(`DROP TABLE \`time_log\``);
		await queryRunner.query(`DROP INDEX \`IDX_fa1896dc735403799311968f7e\` ON \`screenshot\``);
		await queryRunner.query(`DROP INDEX \`IDX_5b594d02d98d5defcde323abe5\` ON \`screenshot\``);
		await queryRunner.query(`DROP INDEX \`IDX_eea7986acfb827bf5d0622c41f\` ON \`screenshot\``);
		await queryRunner.query(`DROP INDEX \`IDX_1b0867d86ead2332f3d4edba7d\` ON \`screenshot\``);
		await queryRunner.query(`DROP INDEX \`IDX_2b374e5cdee1145ebb2a832f20\` ON \`screenshot\``);
		await queryRunner.query(`DROP INDEX \`IDX_3d7feb5fe793e4811cdb79f983\` ON \`screenshot\``);
		await queryRunner.query(`DROP INDEX \`IDX_0951aacffe3f8d0cff54cf2f34\` ON \`screenshot\``);
		await queryRunner.query(`DROP INDEX \`IDX_235004f3dafac90692cd64d915\` ON \`screenshot\``);
		await queryRunner.query(`DROP INDEX \`IDX_892e285e1da2b3e61e51e50628\` ON \`screenshot\``);
		await queryRunner.query(`DROP INDEX \`IDX_742688858e0484d66f04e4d4c4\` ON \`screenshot\``);
		await queryRunner.query(`DROP TABLE \`screenshot\``);
		await queryRunner.query(`DROP INDEX \`IDX_2743f8990fde12f9586287eb09\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_4e382caaf07ab0923b2e06bf91\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_5a898f44fa31ef7916f0c38b01\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_a6f74ae99d549932391f0f4460\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_ffd736f18ba71b3221e4f835a9\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_0e36a2c95e2f1df7f1b3059d24\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_f27285af15ef48363745ab2d79\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_b5525385e85f7429e233d4a0fa\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_302b60a4970ffe94d5223f1c23\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_a28a1682ea80f10d1ecc7babaa\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_fdb3f018c2bba4885bfa5757d1\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_f2401d8fdff5d8970dfe30d3ae\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_d2d6db7f03da5632687e5d140e\` ON \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_ae6ac57aafef59f561d4db3dd7\` ON \`activity\``);
		await queryRunner.query(`DROP TABLE \`activity\``);
		await queryRunner.query(`DROP INDEX \`IDX_c009cdd795be674c2047062374\` ON \`time_off_request\``);
		await queryRunner.query(`DROP INDEX \`IDX_c1f8ae47dc2f1882afc5045c73\` ON \`time_off_request\``);
		await queryRunner.query(`DROP INDEX \`IDX_981333982a6df8b815957dcbf2\` ON \`time_off_request\``);
		await queryRunner.query(`DROP INDEX \`IDX_4989834dd1c9c8ea3576ed99ce\` ON \`time_off_request\``);
		await queryRunner.query(`DROP INDEX \`IDX_5ddef92c4694e6d650d9e557b3\` ON \`time_off_request\``);
		await queryRunner.query(`DROP INDEX \`IDX_45e4bc4476681f4db2097cc2d5\` ON \`time_off_request\``);
		await queryRunner.query(`DROP TABLE \`time_off_request\``);
		await queryRunner.query(`DROP INDEX \`IDX_7d7f69c79df4a6f152b0e362b1\` ON \`time_off_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_c2744cffeca55c3c9c52bb9789\` ON \`time_off_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_1c0ed84d54f8fbe4af10dfcda1\` ON \`time_off_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_22d919e53cf5f6d836b18d407a\` ON \`time_off_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_cf9377d3bcb7cb996f72268941\` ON \`time_off_policy\``);
		await queryRunner.query(`DROP TABLE \`time_off_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_d154d06dac0d0e0a5d9a083e25\` ON \`tenant\``);
		await queryRunner.query(`DROP INDEX \`IDX_56211336b5ff35fd944f225917\` ON \`tenant\``);
		await queryRunner.query(`DROP INDEX \`IDX_eeedffab85b3534a1068d9270f\` ON \`tenant\``);
		await queryRunner.query(`DROP INDEX \`IDX_b8eb9f3e420aa846f30e291960\` ON \`tenant\``);
		await queryRunner.query(`DROP TABLE \`tenant\``);
		await queryRunner.query(`DROP INDEX \`IDX_affdab301e348b892175f30fa3\` ON \`tenant_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_a7500f9b1b7917bf10882c820e\` ON \`tenant_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_1d9975b98d82f385ae14b4d7c6\` ON \`tenant_setting\``);
		await queryRunner.query(`DROP TABLE \`tenant_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_959e77718a2e76ee56498c1106\` ON \`task_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_91988120385964f213aec8aa84\` ON \`task_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_e9fd8df772ad2d955a65f4c68a\` ON \`task_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_3396dda57286ca17ab61fd3704\` ON \`task_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_9c845f353378371ee3aa60f686\` ON \`task_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_379c8bd0ce203341148c1f99ee\` ON \`task_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_313b0e55871c1c9b6c22341536\` ON \`task_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_7e509a66367ecaf8e3bc96f263\` ON \`task_version\``);
		await queryRunner.query(`DROP TABLE \`task_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_0330b4a942b536d8d1f264abe3\` ON \`task_status\``);
		await queryRunner.query(`DROP INDEX \`IDX_a19e8975e5c296640d457dfc11\` ON \`task_status\``);
		await queryRunner.query(`DROP INDEX \`IDX_68eaba689ed6d3e27ec93d3e88\` ON \`task_status\``);
		await queryRunner.query(`DROP INDEX \`IDX_b0c955f276679dd2b2735c3936\` ON \`task_status\``);
		await queryRunner.query(`DROP INDEX \`IDX_9b9a828a49f4bd6383a4073fe2\` ON \`task_status\``);
		await queryRunner.query(`DROP INDEX \`IDX_efbaf00a743316b394cc31e4a2\` ON \`task_status\``);
		await queryRunner.query(`DROP INDEX \`IDX_79c525a8c2209e90186bfcbea9\` ON \`task_status\``);
		await queryRunner.query(`DROP INDEX \`IDX_25d9737ee153411871b4d20c67\` ON \`task_status\``);
		await queryRunner.query(`DROP TABLE \`task_status\``);
		await queryRunner.query(`DROP INDEX \`IDX_f4438327b3c2afb0832569b2a1\` ON \`task_size\``);
		await queryRunner.query(`DROP INDEX \`IDX_ad6792b26526bd96ab18d63454\` ON \`task_size\``);
		await queryRunner.query(`DROP INDEX \`IDX_1a7b137d009616a2ff1aa6834f\` ON \`task_size\``);
		await queryRunner.query(`DROP INDEX \`IDX_90c54f57b29cc8b67edc2738ae\` ON \`task_size\``);
		await queryRunner.query(`DROP INDEX \`IDX_596512cc6508a482cc23ae6ab7\` ON \`task_size\``);
		await queryRunner.query(`DROP INDEX \`IDX_f6ec2207e50680a475d71c8979\` ON \`task_size\``);
		await queryRunner.query(`DROP INDEX \`IDX_8f26ffc61abaef417b0f807695\` ON \`task_size\``);
		await queryRunner.query(`DROP INDEX \`IDX_d65afcfe2d64e49d43931579a3\` ON \`task_size\``);
		await queryRunner.query(`DROP TABLE \`task_size\``);
		await queryRunner.query(`DROP INDEX \`IDX_4967ebdca0aefb9d43e56695e4\` ON \`task_related_issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_d99fe5b50dbe5078e0d9a9b6a9\` ON \`task_related_issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_61a7cb4452d9e23f91231b7fd6\` ON \`task_related_issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_9423f99da972c150f85dbc11c1\` ON \`task_related_issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_bed691e21fe01cf5aceee72295\` ON \`task_related_issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_b7b0ea8ac2825fb981c1181d11\` ON \`task_related_issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_8177dd93be8044b37d3bb9285d\` ON \`task_related_issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_5a341f51d8f5ec12db24ab033f\` ON \`task_related_issue_type\``);
		await queryRunner.query(`DROP TABLE \`task_related_issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_52b039cff6a1adf6b7f9e49ee4\` ON \`task_priority\``);
		await queryRunner.query(`DROP INDEX \`IDX_db4237960ca989eb7a48cd433b\` ON \`task_priority\``);
		await queryRunner.query(`DROP INDEX \`IDX_46daede7b19176b6ad959d70da\` ON \`task_priority\``);
		await queryRunner.query(`DROP INDEX \`IDX_7d656b4cba8f11e639dbc5aab3\` ON \`task_priority\``);
		await queryRunner.query(`DROP INDEX \`IDX_7fd1b30d159b608cbf59009f68\` ON \`task_priority\``);
		await queryRunner.query(`DROP INDEX \`IDX_1818655f27b8cf4f0d1dbfeb8d\` ON \`task_priority\``);
		await queryRunner.query(`DROP INDEX \`IDX_e6adb82db368af15f2b8cdd4e8\` ON \`task_priority\``);
		await queryRunner.query(`DROP INDEX \`IDX_8ddcc5eeaf96314f53ca486821\` ON \`task_priority\``);
		await queryRunner.query(`DROP TABLE \`task_priority\``);
		await queryRunner.query(`DROP INDEX \`IDX_0848fd2b8c23c0ab55146297cf\` ON \`task_linked_issues\``);
		await queryRunner.query(`DROP INDEX \`IDX_6deea7b3671e45973e191a1502\` ON \`task_linked_issues\``);
		await queryRunner.query(`DROP INDEX \`IDX_24114c4059e6b6991daba541b1\` ON \`task_linked_issues\``);
		await queryRunner.query(`DROP INDEX \`IDX_20b50abc5c97610a75d49ad381\` ON \`task_linked_issues\``);
		await queryRunner.query(`DROP INDEX \`IDX_88021c0cd9508757d3d90333f8\` ON \`task_linked_issues\``);
		await queryRunner.query(`DROP INDEX \`IDX_d49853e18e5bc772f5435b01a5\` ON \`task_linked_issues\``);
		await queryRunner.query(`DROP TABLE \`task_linked_issues\``);
		await queryRunner.query(`DROP INDEX \`taskNumber\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_b8616deefe44d0622233e73fbf\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_2f4bdd2593fd6038aaa91fd107\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_0cbe714983eb0aae5feeee8212\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_1e1f64696aa3a26d3e12c840e5\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_94fe6b3a5aec5f85427df4f8cd\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_3797a20ef5553ae87af126bc2f\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_ed5441fb13e82854a994da5a78\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_7127880d6fae956ecc1c84ac31\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_f092f3386f10f2e2ef5b0b6ad1\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_2fe7a278e6f08d2be55740a939\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_5b0272d923a31c972bed1a1ac4\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_e91cbff3d206f150ccc14d0c3a\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_ca2f7edd5a5ce8f14b257c9d54\` ON \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_3e16c81005c389a4db83c0e5e3\` ON \`task\``);
		await queryRunner.query(`DROP TABLE \`task\``);
		await queryRunner.query(`DROP INDEX \`IDX_586513cceb16777fd14a17bfe1\` ON \`issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_131331557078611a68b4a5b2e7\` ON \`issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_33779b0395f72af0b50dc526d1\` ON \`issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_af2d743ed61571bcdc5d9a27a0\` ON \`issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_4af451ab46a94e94394c72d911\` ON \`issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_16dbef9d1b2b422abdce8ee3ae\` ON \`issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_8b12c913c39c72fe5980427c96\` ON \`issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_1909e9bae7d8b2c920b3e4d859\` ON \`issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_722ce5d7535524b96c6d03f7c4\` ON \`issue_type\``);
		await queryRunner.query(`DROP TABLE \`issue_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_a3ee022203211f678376cd919b\` ON \`task_estimation\``);
		await queryRunner.query(`DROP INDEX \`IDX_8f274646f2bdf4e12990feeb04\` ON \`task_estimation\``);
		await queryRunner.query(`DROP INDEX \`IDX_16507eb222e3c50be077fb4ace\` ON \`task_estimation\``);
		await queryRunner.query(`DROP INDEX \`IDX_87bfea6d0b9a1ec602ee88e5f6\` ON \`task_estimation\``);
		await queryRunner.query(`DROP INDEX \`IDX_1f3ffda4fce02682e76308b476\` ON \`task_estimation\``);
		await queryRunner.query(`DROP INDEX \`IDX_b1a7086c279309b20e8384d0d9\` ON \`task_estimation\``);
		await queryRunner.query(`DROP TABLE \`task_estimation\``);
		await queryRunner.query(`DROP INDEX \`IDX_49746602acc4e5e8721062b69e\` ON \`tag\``);
		await queryRunner.query(`DROP INDEX \`IDX_c2f6bec0b39eaa3a6d90903ae9\` ON \`tag\``);
		await queryRunner.query(`DROP INDEX \`IDX_b08dd29fb6a8acdf83c83d8988\` ON \`tag\``);
		await queryRunner.query(`DROP INDEX \`IDX_58876ee26a90170551027459bf\` ON \`tag\``);
		await queryRunner.query(`DROP INDEX \`IDX_1f22c73374bcca1ea84a4dca59\` ON \`tag\``);
		await queryRunner.query(`DROP TABLE \`tag\``);
		await queryRunner.query(`DROP INDEX \`IDX_b2923d394f3636671ff9b3c3e8\` ON \`skill\``);
		await queryRunner.query(`DROP INDEX \`IDX_8e502eac7ed1347c71c26beae8\` ON \`skill\``);
		await queryRunner.query(`DROP INDEX \`IDX_ca52119f9e4857399706d723e9\` ON \`skill\``);
		await queryRunner.query(`DROP INDEX \`IDX_f4cdbe61d68413f4d6a671f8c2\` ON \`skill\``);
		await queryRunner.query(`DROP TABLE \`skill\``);
		await queryRunner.query(`DROP INDEX \`IDX_ae4578dcaed5adff96595e6166\` ON \`role\``);
		await queryRunner.query(`DROP INDEX \`IDX_1751a572e91385a09d41c62471\` ON \`role\``);
		await queryRunner.query(`DROP INDEX \`IDX_09868c0733ba37a4753ff8931f\` ON \`role\``);
		await queryRunner.query(`DROP INDEX \`IDX_c5f75cd3367769b6f22b298d29\` ON \`role\``);
		await queryRunner.query(`DROP TABLE \`role\``);
		await queryRunner.query(`DROP INDEX \`IDX_e3130a39c1e4a740d044e68573\` ON \`role_permission\``);
		await queryRunner.query(`DROP INDEX \`IDX_8307c5c44a4ad6210b767b17a9\` ON \`role_permission\``);
		await queryRunner.query(`DROP INDEX \`IDX_cbd053921056e77c0a8e03122a\` ON \`role_permission\``);
		await queryRunner.query(`DROP INDEX \`IDX_5c36df1a5c85016952e90d760f\` ON \`role_permission\``);
		await queryRunner.query(`DROP INDEX \`IDX_78f93dbb42a97f6785bcf53efd\` ON \`role_permission\``);
		await queryRunner.query(`DROP TABLE \`role_permission\``);
		await queryRunner.query(`DROP INDEX \`IDX_26bb3420001d31337393ed05bc\` ON \`request_approval\``);
		await queryRunner.query(`DROP INDEX \`IDX_c63fafc733ff8ab37dede8ffec\` ON \`request_approval\``);
		await queryRunner.query(`DROP INDEX \`IDX_8343741e7929043b2a7de89f73\` ON \`request_approval\``);
		await queryRunner.query(`DROP INDEX \`IDX_9feaa23ed7bc47d51315e304bb\` ON \`request_approval\``);
		await queryRunner.query(`DROP INDEX \`IDX_c77295d7f5d6086c815de3c120\` ON \`request_approval\``);
		await queryRunner.query(`DROP INDEX \`IDX_db152600f88a9a4888df0b626e\` ON \`request_approval\``);
		await queryRunner.query(`DROP TABLE \`request_approval\``);
		await queryRunner.query(`DROP INDEX \`IDX_9ccdaee6c5c62cda8f7375e841\` ON \`request_approval_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_6c75d8a8c609e88896b2653cc4\` ON \`request_approval_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_77e1050669b32cfff482f96016\` ON \`request_approval_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_94b2a3d0f17c9549dea1493dc9\` ON \`request_approval_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_bdcb4ea389bdb794bae75b0170\` ON \`request_approval_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_34b2e8f794e0336b9ac410d8bd\` ON \`request_approval_team\``);
		await queryRunner.query(`DROP TABLE \`request_approval_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_ce2113039f070b3f003aa0db61\` ON \`request_approval_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_563fec5539b89a57f40731f985\` ON \`request_approval_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_4071f027554eefff65ac8123e6\` ON \`request_approval_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_a5445b38b780b29b09369e36a9\` ON \`request_approval_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_3d66190c19b9fe69a8bbb300df\` ON \`request_approval_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_2634ff04775e659c4792325f38\` ON \`request_approval_employee\``);
		await queryRunner.query(`DROP TABLE \`request_approval_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_230652e48daa99c50c000fc5d1\` ON \`report\``);
		await queryRunner.query(`DROP INDEX \`IDX_ef16fed5f7e6951027502e6458\` ON \`report\``);
		await queryRunner.query(`DROP INDEX \`IDX_6f9ee54eb839117e83b937648d\` ON \`report\``);
		await queryRunner.query(`DROP INDEX \`IDX_1316fdd7b9a2926437a13271bf\` ON \`report\``);
		await queryRunner.query(`DROP INDEX \`IDX_143ead1a6ac5f73125d8c4c3aa\` ON \`report\``);
		await queryRunner.query(`DROP TABLE \`report\``);
		await queryRunner.query(`DROP INDEX \`IDX_5193788a3ebc1143bedb74cf72\` ON \`report_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_edf9bd011d7f08e3e18a5becb8\` ON \`report_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_40459267d68604655aa6df4251\` ON \`report_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_a6bde8f44e18f17b1ca603e150\` ON \`report_organization\``);
		await queryRunner.query(`DROP TABLE \`report_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_fa278d337ba5e200d44ade6697\` ON \`report_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_656f05f951faa13d7195853424\` ON \`report_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_dd9fcd7916d0a22189ecea6a36\` ON \`report_category\``);
		await queryRunner.query(`DROP TABLE \`report_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_cc28a54171231fbd9a127051f0\` ON \`proposal\``);
		await queryRunner.query(`DROP INDEX \`IDX_d59ec6899d435f430799795ad7\` ON \`proposal\``);
		await queryRunner.query(`DROP INDEX \`IDX_4177329f5e6ddbfb6416592713\` ON \`proposal\``);
		await queryRunner.query(`DROP INDEX \`IDX_e2836e856f491dd4676e1ec8d3\` ON \`proposal\``);
		await queryRunner.query(`DROP INDEX \`IDX_61a30a7d83666bf265fd86a72d\` ON \`proposal\``);
		await queryRunner.query(`DROP TABLE \`proposal\``);
		await queryRunner.query(`DROP INDEX \`IDX_d24bc28e54f1dc296452a25591\` ON \`product_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_e6abcacc3d3a4f9cf5ca97f2b2\` ON \`product_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_7533fd275bfb3219ce9eb4004c\` ON \`product_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_96413a8061ff4ccdc418d4e16a\` ON \`product_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_1d9ca23c7e1c606061fec8bb74\` ON \`product_translation\``);
		await queryRunner.query(`DROP TABLE \`product_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_618194d24a7ea86a165d7ec628\` ON \`product\``);
		await queryRunner.query(`DROP INDEX \`IDX_374bfd0d1b0e1398d7206456d9\` ON \`product\``);
		await queryRunner.query(`DROP INDEX \`IDX_4627873dbc1af07d732e6eec7b\` ON \`product\``);
		await queryRunner.query(`DROP INDEX \`IDX_32a4bdd261ec81f4ca6b3abe26\` ON \`product\``);
		await queryRunner.query(`DROP INDEX \`IDX_08293ca31a601d3cd0228120bc\` ON \`product\``);
		await queryRunner.query(`DROP INDEX \`IDX_6f58935aa2175d930e47e97c9f\` ON \`product\``);
		await queryRunner.query(`DROP INDEX \`IDX_7bb2b2f7a4c8a4916d4339d7f4\` ON \`product\``);
		await queryRunner.query(`DROP TABLE \`product\``);
		await queryRunner.query(`DROP INDEX \`REL_9f0fd369dfeb275415c649d110\` ON \`product_variant\``);
		await queryRunner.query(`DROP INDEX \`REL_41b31a71dda350cfe5da07e0e4\` ON \`product_variant\``);
		await queryRunner.query(`DROP INDEX \`IDX_b83f23626741630a8629960715\` ON \`product_variant\``);
		await queryRunner.query(`DROP INDEX \`IDX_6e420052844edf3a5506d863ce\` ON \`product_variant\``);
		await queryRunner.query(`DROP INDEX \`IDX_6a289b10030ae86903406e3c9b\` ON \`product_variant\``);
		await queryRunner.query(`DROP INDEX \`IDX_9121e00c4dc3500dc610cf8722\` ON \`product_variant\``);
		await queryRunner.query(`DROP INDEX \`IDX_e0005cbdabb760488f66f3fbba\` ON \`product_variant\``);
		await queryRunner.query(`DROP INDEX \`IDX_e0d896cadbc695a490f64bb7e7\` ON \`product_variant\``);
		await queryRunner.query(`DROP TABLE \`product_variant\``);
		await queryRunner.query(`DROP INDEX \`REL_5842f603bd85d924127d63d73c\` ON \`product_variant_price\``);
		await queryRunner.query(`DROP INDEX \`IDX_0cfba32db58a952f58b1e35cf1\` ON \`product_variant_price\``);
		await queryRunner.query(`DROP INDEX \`IDX_7052eaf00a5795afa5ebf35995\` ON \`product_variant_price\``);
		await queryRunner.query(`DROP INDEX \`IDX_24ac11e35221577e4ba4fdd229\` ON \`product_variant_price\``);
		await queryRunner.query(`DROP INDEX \`IDX_562ef5984b6d4bed640bfcc6a2\` ON \`product_variant_price\``);
		await queryRunner.query(`DROP TABLE \`product_variant_price\``);
		await queryRunner.query(`DROP INDEX \`IDX_e4e4120b0c19d3a207ce38d758\` ON \`product_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_f206c807fc7e41fc8a8b6679ae\` ON \`product_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_49064ee0f3acd5882f4d893f3d\` ON \`product_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_90cc635a1065702ed3b79da6ec\` ON \`product_type\``);
		await queryRunner.query(`DROP TABLE \`product_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_f4b767c43b4e9130c63382c9b2\` ON \`product_type_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_2dd271bdeb602b8c3956287e33\` ON \`product_type_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_30aafca59cdb456bf5231f9e46\` ON \`product_type_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_65874d6bab7fefcaeccd2252c1\` ON \`product_type_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_e9dca49bad996f1761db3b2f56\` ON \`product_type_translation\``);
		await queryRunner.query(`DROP TABLE \`product_type_translation\``);
		await queryRunner.query(`DROP INDEX \`REL_b0d86990fe7160a5f3e4011fb2\` ON \`product_variant_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_bed9d45e15866d9b8e87e7a7bf\` ON \`product_variant_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_2efe48435d4ba480a4bb8b96fa\` ON \`product_variant_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_ae78776111e1906accfd61511d\` ON \`product_variant_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_ad107ba78e487cd8b13313593b\` ON \`product_variant_setting\``);
		await queryRunner.query(`DROP TABLE \`product_variant_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_a6debf9198e2fbfa006aa10d71\` ON \`product_option\``);
		await queryRunner.query(`DROP INDEX \`IDX_47ffb82a65c43f102b7e0efa41\` ON \`product_option\``);
		await queryRunner.query(`DROP INDEX \`IDX_985d235aa5394937c4493262c7\` ON \`product_option\``);
		await queryRunner.query(`DROP INDEX \`IDX_35d083f4ecfe72cce72ee88f58\` ON \`product_option\``);
		await queryRunner.query(`DROP INDEX \`IDX_d81028785f188c253e0bd49a03\` ON \`product_option\``);
		await queryRunner.query(`DROP TABLE \`product_option\``);
		await queryRunner.query(`DROP INDEX \`IDX_f43c46e12db0580af320db7738\` ON \`product_option_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_4dc2f466cfa3d0b7fef19d1273\` ON \`product_option_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_9869d7680f48487e584f5d2fca\` ON \`product_option_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_2f581c3477a5c7a66de5d7f264\` ON \`product_option_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_f284f666950392c55afa0806c8\` ON \`product_option_translation\``);
		await queryRunner.query(`DROP TABLE \`product_option_translation\``);
		await queryRunner.query(
			`DROP INDEX \`IDX_c9ce1da98b6d93293daafee63a\` ON \`product_option_group_translation\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_0e2fcc31743e20a45fc3cf0211\` ON \`product_option_group_translation\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_fd6b39f1fd1db026b5dcc3c795\` ON \`product_option_group_translation\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_e9e50109d3054fb81205c0a74e\` ON \`product_option_group_translation\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_75b7065234a6d32fbd03d8703f\` ON \`product_option_group_translation\``
		);
		await queryRunner.query(`DROP TABLE \`product_option_group_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_a6e91739227bf4d442f23c52c7\` ON \`product_option_group\``);
		await queryRunner.query(`DROP INDEX \`IDX_4a1430a01b71ecdfcd54b2b6c5\` ON \`product_option_group\``);
		await queryRunner.query(`DROP INDEX \`IDX_462a7fd3ce68935cf973c6709f\` ON \`product_option_group\``);
		await queryRunner.query(`DROP INDEX \`IDX_76bda4c33c83614617278617ae\` ON \`product_option_group\``);
		await queryRunner.query(`DROP INDEX \`IDX_0fc743f2bc16502dbc5e85420c\` ON \`product_option_group\``);
		await queryRunner.query(`DROP TABLE \`product_option_group\``);
		await queryRunner.query(`DROP INDEX \`IDX_f38e86bd280ff9c9c7d9cb7839\` ON \`product_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_853302351eaa4daa39920c270a\` ON \`product_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_0a0cf25cd8232a154d1cce2641\` ON \`product_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_06cd3959f09e0b12793a763515\` ON \`product_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_198fba43f049ea621407e7d188\` ON \`product_category\``);
		await queryRunner.query(`DROP TABLE \`product_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_586294149d24cd835678878ef1\` ON \`product_category_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_e46203bf1dbf3291d174f02cb3\` ON \`product_category_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_27d71aa2e843f07fbf36329be3\` ON \`product_category_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_d32c5d5e4451acf44fd5b212ce\` ON \`product_category_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_e690dd59b69e74a6bb5d94f32b\` ON \`product_category_translation\``);
		await queryRunner.query(`DROP TABLE \`product_category_translation\``);
		await queryRunner.query(`DROP INDEX \`IDX_873ade98fbd6ca71c8b4d1bbca\` ON \`pipeline\``);
		await queryRunner.query(`DROP INDEX \`IDX_683274c59fb08b21249096e305\` ON \`pipeline\``);
		await queryRunner.query(`DROP INDEX \`IDX_1adf9f97094bc93e176ede2482\` ON \`pipeline\``);
		await queryRunner.query(`DROP INDEX \`IDX_f3027eabd451ec18b93fab7ed5\` ON \`pipeline\``);
		await queryRunner.query(`DROP TABLE \`pipeline\``);
		await queryRunner.query(`DROP INDEX \`IDX_04d16bdd72668de12c3e41a85a\` ON \`pipeline_stage\``);
		await queryRunner.query(`DROP INDEX \`IDX_28965bf63ad4c0976892d0fd5e\` ON \`pipeline_stage\``);
		await queryRunner.query(`DROP INDEX \`IDX_074caa106ee22d5d675a696a98\` ON \`pipeline_stage\``);
		await queryRunner.query(`DROP INDEX \`IDX_a6acee4ad726734b73f3886c14\` ON \`pipeline_stage\``);
		await queryRunner.query(`DROP TABLE \`pipeline_stage\``);
		await queryRunner.query(`DROP INDEX \`IDX_82753b9e315af84b20eaf84d77\` ON \`payment\``);
		await queryRunner.query(`DROP INDEX \`IDX_8846e403ec45e1ad8c309f91a3\` ON \`payment\``);
		await queryRunner.query(`DROP INDEX \`IDX_3f13c738eff604a85700746ec7\` ON \`payment\``);
		await queryRunner.query(`DROP INDEX \`IDX_87223c7f1d4c2ca51cf6992784\` ON \`payment\``);
		await queryRunner.query(`DROP INDEX \`IDX_62ef561a3bb084a7d12dad8a2d\` ON \`payment\``);
		await queryRunner.query(`DROP INDEX \`IDX_be7fcc9fb8cd5a74cb602ec6c9\` ON \`payment\``);
		await queryRunner.query(`DROP INDEX \`IDX_6959c37c3acf0832103a253570\` ON \`payment\``);
		await queryRunner.query(`DROP INDEX \`IDX_8c4018eab11e92c3b09583495f\` ON \`payment\``);
		await queryRunner.query(`DROP INDEX \`IDX_16a49d62227bf23686b77b5a21\` ON \`payment\``);
		await queryRunner.query(`DROP TABLE \`payment\``);
		await queryRunner.query(`DROP INDEX \`IDX_36e929b98372d961bb63bd4b4e\` ON \`password_reset\``);
		await queryRunner.query(`DROP INDEX \`IDX_1c88db6e50f0704688d1f1978c\` ON \`password_reset\``);
		await queryRunner.query(`DROP INDEX \`IDX_1fa632f2d12a06ef8dcc00858f\` ON \`password_reset\``);
		await queryRunner.query(`DROP INDEX \`IDX_e71a736d52820b568f6b0ca203\` ON \`password_reset\``);
		await queryRunner.query(`DROP INDEX \`IDX_380c03025a41ad032191f1ef2d\` ON \`password_reset\``);
		await queryRunner.query(`DROP TABLE \`password_reset\``);
		await queryRunner.query(`DROP INDEX \`IDX_47b6a97e09895a06606a4a8042\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_7965db2b12872551b586f76dd7\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_2360aa7a4b5ab99e026584f305\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_15458cef74076623c270500053\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_9ea70bf5c390b00e7bb96b86ed\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_c75285bf286b17c7ca5537857b\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_f37d866c3326eca5f579cef35c\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_b03a8a28f6ebdb6df8f630216b\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_6cc2b2052744e352834a4c9e78\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_40460ab803bf6e5a62b75a35c5\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_03e5eecc2328eb545ff748cbdd\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_c21e615583a3ebbb0977452afb\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_745a293c8b2c750bc421fa0633\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_b2091c1795f1d0d919b278ab23\` ON \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_6de52b8f3de32abee3df2628a3\` ON \`organization\``);
		await queryRunner.query(`DROP TABLE \`organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_e56e80136b07ecd52545368611\` ON \`organization_vendor\``);
		await queryRunner.query(`DROP INDEX \`IDX_56dd132aa3743cfa9b034d020e\` ON \`organization_vendor\``);
		await queryRunner.query(`DROP INDEX \`IDX_7e0bf6063e1728c9813d5da7ca\` ON \`organization_vendor\``);
		await queryRunner.query(`DROP INDEX \`IDX_266972cd6ff9656eec8818e12d\` ON \`organization_vendor\``);
		await queryRunner.query(`DROP INDEX \`IDX_04c6320f910056ecb11b147ac8\` ON \`organization_vendor\``);
		await queryRunner.query(`DROP TABLE \`organization_vendor\``);
		await queryRunner.query(`DROP INDEX \`IDX_51e91be110fa0b8e70066f5727\` ON \`organization_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_da625f694eb1e23e585f301008\` ON \`organization_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_e22ab0f1236b1a07785b641727\` ON \`organization_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_103ae3eb65f4b091efc55cb532\` ON \`organization_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_eef1c19a0cb5321223cfe3286c\` ON \`organization_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_176f5ed3c4534f3110d423d569\` ON \`organization_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_38f1d96e8c2d59e4f0f84209ab\` ON \`organization_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_722d648e0b83267d4a66332ccb\` ON \`organization_team\``);
		await queryRunner.query(`DROP TABLE \`organization_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_171b852be7c1f387eca93775aa\` ON \`organization_team_join_request\``);
		await queryRunner.query(`DROP INDEX \`IDX_5e73656ce0355347477c42ae19\` ON \`organization_team_join_request\``);
		await queryRunner.query(`DROP INDEX \`IDX_c15823bf3f63b1fe331d9de662\` ON \`organization_team_join_request\``);
		await queryRunner.query(`DROP INDEX \`IDX_d9529008c733cb90044b8c2ad6\` ON \`organization_team_join_request\``);
		await queryRunner.query(`DROP INDEX \`IDX_b027ee2cb18245356b8d963d2f\` ON \`organization_team_join_request\``);
		await queryRunner.query(`DROP INDEX \`IDX_29ece7e3bb764028387cdbc888\` ON \`organization_team_join_request\``);
		await queryRunner.query(`DROP TABLE \`organization_team_join_request\``);
		await queryRunner.query(`DROP INDEX \`IDX_ce83034f38496f5fe3f1979697\` ON \`organization_team_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_a2a5601d799fbfc29c17b99243\` ON \`organization_team_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_8dc83cdd7c519d73afc0d8bdf0\` ON \`organization_team_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_719aeb37fa7a1dd80d25336a0c\` ON \`organization_team_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_d8eba1c0e500c60be1b69c1e77\` ON \`organization_team_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_fe12e1b76bbb76209134d9bdc2\` ON \`organization_team_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_752d7a0fe6597ee6bbc6502a12\` ON \`organization_team_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_70fcc451944fbde73d223c2af3\` ON \`organization_team_employee\``);
		await queryRunner.query(`DROP TABLE \`organization_team_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_20a290f166c0810eafbf271717\` ON \`organization_task_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_19ab7adf33199bc6f913db277d\` ON \`organization_task_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_5830901876e426adfc15fb7341\` ON \`organization_task_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_582768159ef0c749e8552ea9bc\` ON \`organization_task_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_b7be7e61daf2b5af3232c9c4d6\` ON \`organization_task_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_f0e2385b2d5f176f9ed3b6a9e3\` ON \`organization_task_setting\``);
		await queryRunner.query(`DROP TABLE \`organization_task_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_8a1fe8afb3aa672bae5993fbe7\` ON \`organization_sprint\``);
		await queryRunner.query(`DROP INDEX \`IDX_f57ad03c4e471bd8530494ea63\` ON \`organization_sprint\``);
		await queryRunner.query(`DROP INDEX \`IDX_76e53f9609ca05477d50980743\` ON \`organization_sprint\``);
		await queryRunner.query(`DROP INDEX \`IDX_5596b4fa7fb2ceb0955580becd\` ON \`organization_sprint\``);
		await queryRunner.query(`DROP TABLE \`organization_sprint\``);
		await queryRunner.query(`DROP INDEX \`IDX_637ac2c467df4bc3b71795a866\` ON \`organization_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_61387780d015923453f4b015b4\` ON \`organization_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_f1e5497ee6be7ba3f2ee90bf4b\` ON \`organization_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_8a12e7a0d47d3c6a6b35f7984e\` ON \`organization_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_0b19a287858af40661bd3eb741\` ON \`organization_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_f3ef2000abb9762b138cc5a1b3\` ON \`organization_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_9ad08dbc039d08279dae2dd94e\` ON \`organization_recurring_expense\``);
		await queryRunner.query(`DROP TABLE \`organization_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_063324fdceb51f7086e401ed2c\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_bc1e32c13683dbb16ada1c6da1\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_904ae0b765faef6ba2db8b1e69\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_3e128d30e9910ff920eee4ef37\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_c5c4366237dc2bb176c1503426\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_75855b44250686f84b7c4bc1f1\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_c210effeb6314d325bc024d21e\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_37215da8dee9503d759adb3538\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_9d8afc1e1e64d4b7d48dd2229d\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_7cf84e8b5775f349f81a1f3cc4\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_3590135ac2034d7aa88efa7e52\` ON \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_18e22d4b569159bb91dec869aa\` ON \`organization_project\``);
		await queryRunner.query(`DROP TABLE \`organization_project\``);
		await queryRunner.query(`DROP INDEX \`IDX_3f02c20145af9997253531349c\` ON \`organization_position\``);
		await queryRunner.query(`DROP INDEX \`IDX_a0409e39f23ff6d418f2c03df5\` ON \`organization_position\``);
		await queryRunner.query(`DROP INDEX \`IDX_a8f497b1006ec967964abb0d49\` ON \`organization_position\``);
		await queryRunner.query(`DROP INDEX \`IDX_ce8721ddf715f0efa4bd3d2c5f\` ON \`organization_position\``);
		await queryRunner.query(`DROP INDEX \`IDX_7317abf7a05a169783b6aa7932\` ON \`organization_position\``);
		await queryRunner.query(`DROP TABLE \`organization_position\``);
		await queryRunner.query(`DROP INDEX \`IDX_020516e74a57cb85d75381e841\` ON \`organization_language\``);
		await queryRunner.query(`DROP INDEX \`IDX_4513931e2d530f78d7144c8c7c\` ON \`organization_language\``);
		await queryRunner.query(`DROP INDEX \`IDX_225e476592214e32e117a85213\` ON \`organization_language\``);
		await queryRunner.query(`DROP INDEX \`IDX_6577ec9ca4cef331a507264d44\` ON \`organization_language\``);
		await queryRunner.query(`DROP INDEX \`IDX_b79e8d45a3ef5503579643f5de\` ON \`organization_language\``);
		await queryRunner.query(`DROP TABLE \`organization_language\``);
		await queryRunner.query(`DROP INDEX \`IDX_a583cfe32f492f5ba99b7bb205\` ON \`organization_employment_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_227b5bd9867287cbbeece8f6ba\` ON \`organization_employment_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_cc096d49e2399e89cdf32297da\` ON \`organization_employment_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_880f3cce5e03f42bec3da6e6dc\` ON \`organization_employment_type\``);
		await queryRunner.query(`DROP TABLE \`organization_employment_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_c129dee7d1cb84e01e69b5e2c6\` ON \`organization_document\``);
		await queryRunner.query(`DROP INDEX \`IDX_1057ec001a4c6b258658143047\` ON \`organization_document\``);
		await queryRunner.query(`DROP INDEX \`IDX_4bc83945c022a862a33629ff1e\` ON \`organization_document\``);
		await queryRunner.query(`DROP INDEX \`IDX_72c6a8ad9de5c04b2b689fd229\` ON \`organization_document\``);
		await queryRunner.query(`DROP INDEX \`IDX_e5edb48261db95f46c3b4d34a5\` ON \`organization_document\``);
		await queryRunner.query(`DROP TABLE \`organization_document\``);
		await queryRunner.query(`DROP INDEX \`IDX_91b652409dc1fb2f712590dd21\` ON \`organization_department\``);
		await queryRunner.query(`DROP INDEX \`IDX_c61a562a2379d1c0077fe7de33\` ON \`organization_department\``);
		await queryRunner.query(`DROP INDEX \`IDX_b3644ff7cd65239e29d292a41d\` ON \`organization_department\``);
		await queryRunner.query(`DROP INDEX \`IDX_b65059949804b20048b1c86c3d\` ON \`organization_department\``);
		await queryRunner.query(`DROP INDEX \`IDX_6139cd4c620e81aefd4895d370\` ON \`organization_department\``);
		await queryRunner.query(`DROP TABLE \`organization_department\``);
		await queryRunner.query(`DROP INDEX \`REL_a86d2e378b953cb39261f457d2\` ON \`organization_contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_8cfcdc6bc8fb55e273d9ace5fd\` ON \`organization_contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_a86d2e378b953cb39261f457d2\` ON \`organization_contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_de33f92e042365d196d959e774\` ON \`organization_contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_6200736cb4d3617b004e5b647f\` ON \`organization_contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_e68c43e315ad3aaea4e99cf461\` ON \`organization_contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_f91783c7a8565c648b65635efc\` ON \`organization_contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_53627a383c9817dbf1164d7dc6\` ON \`organization_contact\``);
		await queryRunner.query(`DROP TABLE \`organization_contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_31626e7d39eb95b710d5a2d80f\` ON \`organization_award\``);
		await queryRunner.query(`DROP INDEX \`IDX_2e0d21aab892b5993abaac09bc\` ON \`organization_award\``);
		await queryRunner.query(`DROP INDEX \`IDX_af6423760433da72002a7f369e\` ON \`organization_award\``);
		await queryRunner.query(`DROP INDEX \`IDX_34c6749e2bc94b2e52e9572f32\` ON \`organization_award\``);
		await queryRunner.query(`DROP INDEX \`IDX_4062b5d54aa740aaff9a6c5fbb\` ON \`organization_award\``);
		await queryRunner.query(`DROP TABLE \`organization_award\``);
		await queryRunner.query(`DROP INDEX \`REL_e03ddff05652be527e04abdc56\` ON \`merchant\``);
		await queryRunner.query(`DROP INDEX \`IDX_20acc3c3a6c900c6ef9fc68199\` ON \`merchant\``);
		await queryRunner.query(`DROP INDEX \`IDX_e03ddff05652be527e04abdc56\` ON \`merchant\``);
		await queryRunner.query(`DROP INDEX \`IDX_d306a524b507f72fa8550aeffe\` ON \`merchant\``);
		await queryRunner.query(`DROP INDEX \`IDX_533144d7ae94180235ea456625\` ON \`merchant\``);
		await queryRunner.query(`DROP INDEX \`IDX_0a0f972564e74c9c4905e3abcb\` ON \`merchant\``);
		await queryRunner.query(`DROP INDEX \`IDX_a03be8a86e528e2720504a041f\` ON \`merchant\``);
		await queryRunner.query(`DROP TABLE \`merchant\``);
		await queryRunner.query(`DROP INDEX \`IDX_465b3173cdddf0ac2d3fe73a33\` ON \`language\``);
		await queryRunner.query(`DROP INDEX \`IDX_15fcb8179bc7b0642ca78da69e\` ON \`language\``);
		await queryRunner.query(`DROP INDEX \`IDX_3a7abee35dfa3c90ed491583eb\` ON \`language\``);
		await queryRunner.query(`DROP TABLE \`language\``);
		await queryRunner.query(`DROP INDEX \`IDX_3e1d08761a717c1dd71fe67249\` ON \`key_result\``);
		await queryRunner.query(`DROP INDEX \`IDX_4e1e975124c1d717814a4bb2ec\` ON \`key_result\``);
		await queryRunner.query(`DROP INDEX \`IDX_d8547e21ccb8e37ac9f0d69c1a\` ON \`key_result\``);
		await queryRunner.query(`DROP INDEX \`IDX_38dc003f3484eff4b59918e9ae\` ON \`key_result\``);
		await queryRunner.query(`DROP INDEX \`IDX_c89adeff0de3aedb2e772a5bf4\` ON \`key_result\``);
		await queryRunner.query(`DROP INDEX \`IDX_5880347716f9ec5056ec15112c\` ON \`key_result\``);
		await queryRunner.query(`DROP INDEX \`IDX_d1f45ca98f17bd84a5e430feaf\` ON \`key_result\``);
		await queryRunner.query(`DROP INDEX \`IDX_8ac2c6b487d03157adda874789\` ON \`key_result\``);
		await queryRunner.query(`DROP INDEX \`IDX_8889e2618366faefa575a8049b\` ON \`key_result\``);
		await queryRunner.query(`DROP INDEX \`IDX_9b62dd2dddcde032f46a981733\` ON \`key_result\``);
		await queryRunner.query(`DROP TABLE \`key_result\``);
		await queryRunner.query(`DROP INDEX \`IDX_fd4b0cb7a44ed914acdda55e29\` ON \`key_result_update\``);
		await queryRunner.query(`DROP INDEX \`IDX_cd9cbc0d5b6d62dbb63c3b3a65\` ON \`key_result_update\``);
		await queryRunner.query(`DROP INDEX \`IDX_94aad97b26aede6545a3226fb3\` ON \`key_result_update\``);
		await queryRunner.query(`DROP INDEX \`IDX_12b8b54f416ec9f5ec002f0a83\` ON \`key_result_update\``);
		await queryRunner.query(`DROP TABLE \`key_result_update\``);
		await queryRunner.query(`DROP INDEX \`IDX_46426ea45456e240a092b73204\` ON \`key_result_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_fab6b6200b9ed6fd002c1ff62a\` ON \`key_result_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_86c09eb673b0e66129dbdc7211\` ON \`key_result_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_aa0e9b0cfcba1926925b025512\` ON \`key_result_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_f4e813d72dc732f16497ee2c52\` ON \`key_result_template\``);
		await queryRunner.query(`DROP TABLE \`key_result_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_d7bed97fb47876e03fd7d7c285\` ON \`invoice\``);
		await queryRunner.query(`DROP INDEX \`IDX_d9e965da0f63c94983d3a1006a\` ON \`invoice\``);
		await queryRunner.query(`DROP INDEX \`IDX_b5c33892e630b66c65d623baf8\` ON \`invoice\``);
		await queryRunner.query(`DROP INDEX \`IDX_058ef835f99e28fc6717cd7c80\` ON \`invoice\``);
		await queryRunner.query(`DROP INDEX \`IDX_7fb52a5f267f53b7d93af3d8c3\` ON \`invoice\``);
		await queryRunner.query(`DROP INDEX \`IDX_eabacf7474d75e53d7b7046f3e\` ON \`invoice\``);
		await queryRunner.query(`DROP INDEX \`IDX_850ca385c1985c1808cd4ea241\` ON \`invoice\``);
		await queryRunner.query(`DROP TABLE \`invoice\``);
		await queryRunner.query(`DROP INDEX \`IDX_e89749c8e8258b2ec110c0776f\` ON \`invoice_item\``);
		await queryRunner.query(`DROP INDEX \`IDX_f78214cd9de76e80fe8a6305f5\` ON \`invoice_item\``);
		await queryRunner.query(`DROP INDEX \`IDX_b7da14d2b61cf1dd5c65188b9c\` ON \`invoice_item\``);
		await queryRunner.query(`DROP INDEX \`IDX_e2835fd8776ae5d56d892e087e\` ON \`invoice_item\``);
		await queryRunner.query(`DROP TABLE \`invoice_item\``);
		await queryRunner.query(`DROP INDEX \`IDX_31ec3d5a6b0985cec544c64217\` ON \`invoice_estimate_history\``);
		await queryRunner.query(`DROP INDEX \`IDX_da2893697d57368470952a76f6\` ON \`invoice_estimate_history\``);
		await queryRunner.query(`DROP INDEX \`IDX_856f24297f120604f8ae294276\` ON \`invoice_estimate_history\``);
		await queryRunner.query(`DROP INDEX \`IDX_cc0ac824ba89deda98bb418e8c\` ON \`invoice_estimate_history\``);
		await queryRunner.query(`DROP INDEX \`IDX_8106063f79cce8e67790d79092\` ON \`invoice_estimate_history\``);
		await queryRunner.query(`DROP INDEX \`IDX_483eb296a94d821ebedb375858\` ON \`invoice_estimate_history\``);
		await queryRunner.query(`DROP TABLE \`invoice_estimate_history\``);
		await queryRunner.query(`DROP INDEX \`IDX_91bfeec7a9574f458e5b592472\` ON \`invite\``);
		await queryRunner.query(`DROP INDEX \`IDX_900a3ed40499c79c1c289fec28\` ON \`invite\``);
		await queryRunner.query(`DROP INDEX \`IDX_5a182e8b3e225b14ddf6df7e6c\` ON \`invite\``);
		await queryRunner.query(`DROP INDEX \`IDX_68eef4ab86b67747f24f288a16\` ON \`invite\``);
		await queryRunner.query(`DROP INDEX \`IDX_7c2328f76efb850b8114797247\` ON \`invite\``);
		await queryRunner.query(`DROP INDEX \`IDX_3cef860504647ccd52d39d7dc2\` ON \`invite\``);
		await queryRunner.query(`DROP INDEX \`IDX_bd44bcb10034bc0c5fe4427b3e\` ON \`invite\``);
		await queryRunner.query(`DROP TABLE \`invite\``);
		await queryRunner.query(`DROP INDEX \`IDX_52d7fa32a7832b377fc2d7f619\` ON \`integration\``);
		await queryRunner.query(`DROP INDEX \`IDX_85d7b0f07f3e3707b4586670a9\` ON \`integration\``);
		await queryRunner.query(`DROP INDEX \`IDX_24981cd300007cf88601c2d616\` ON \`integration\``);
		await queryRunner.query(`DROP TABLE \`integration\``);
		await queryRunner.query(`DROP INDEX \`IDX_83443d669822bbbf2bd0ebdacd\` ON \`integration_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_e7b65ef60492b1c34007736f99\` ON \`integration_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_34a49d941459e1031c766b941f\` ON \`integration_type\``);
		await queryRunner.query(`DROP TABLE \`integration_type\``);
		await queryRunner.query(
			`DROP INDEX \`IDX_5065401113abb6e9608225e567\` ON \`organization_github_repository_issue\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_a8709a9c5cc142c6fbe92df274\` ON \`organization_github_repository_issue\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_055f310a04a928343494a5255a\` ON \`organization_github_repository_issue\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_6c8e119fc6a2a7d3413aa76d3b\` ON \`organization_github_repository_issue\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_b3234be5b70c2362cdf67bb188\` ON \`organization_github_repository_issue\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_c774c276d6b7ea05a7e12d3c81\` ON \`organization_github_repository_issue\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_d706210d377ece2a1bc3386388\` ON \`organization_github_repository_issue\``
		);
		await queryRunner.query(`DROP TABLE \`organization_github_repository_issue\``);
		await queryRunner.query(`DROP INDEX \`IDX_add7dbec156589dd0b27e2e0c4\` ON \`organization_github_repository\``);
		await queryRunner.query(`DROP INDEX \`IDX_59407d03d189560ac1a0a4b0eb\` ON \`organization_github_repository\``);
		await queryRunner.query(`DROP INDEX \`IDX_2eec784cadcb7847b64937fb58\` ON \`organization_github_repository\``);
		await queryRunner.query(`DROP INDEX \`IDX_34c48d11eb82ef42e89370bdc7\` ON \`organization_github_repository\``);
		await queryRunner.query(`DROP INDEX \`IDX_04717f25bea7d9cef0d51cac50\` ON \`organization_github_repository\``);
		await queryRunner.query(`DROP INDEX \`IDX_9e8a77c1d330554fab9230100a\` ON \`organization_github_repository\``);
		await queryRunner.query(`DROP INDEX \`IDX_a146e202c19f521bf5ec69bb26\` ON \`organization_github_repository\``);
		await queryRunner.query(`DROP INDEX \`IDX_6eea42a69e130bbd14b7ea3659\` ON \`organization_github_repository\``);
		await queryRunner.query(`DROP INDEX \`IDX_ca0fa80f50baed7287a499dc2c\` ON \`organization_github_repository\``);
		await queryRunner.query(`DROP INDEX \`IDX_69d75a47af6bfcda545a865691\` ON \`organization_github_repository\``);
		await queryRunner.query(`DROP INDEX \`IDX_480158f21938444e4f62fb3185\` ON \`organization_github_repository\``);
		await queryRunner.query(`DROP INDEX \`IDX_ef65338e8597b9f56fd0fe3c94\` ON \`organization_github_repository\``);
		await queryRunner.query(`DROP INDEX \`IDX_5e97728cfda96f49cc7f95bbaf\` ON \`organization_github_repository\``);
		await queryRunner.query(`DROP TABLE \`organization_github_repository\``);
		await queryRunner.query(`DROP INDEX \`IDX_0d6ddc27d687ca879042c5f3ce\` ON \`integration_tenant\``);
		await queryRunner.query(`DROP INDEX \`IDX_d0532ed8020981736b58748de6\` ON \`integration_tenant\``);
		await queryRunner.query(`DROP INDEX \`IDX_33ab224e7755a46fff5bc1e64e\` ON \`integration_tenant\``);
		await queryRunner.query(`DROP INDEX \`IDX_24e37d03ef224f1a16a35069c2\` ON \`integration_tenant\``);
		await queryRunner.query(`DROP INDEX \`IDX_5487f9197c106d774bae20991c\` ON \`integration_tenant\``);
		await queryRunner.query(`DROP INDEX \`IDX_c5ff5d3ab364b7da72bf3fbb46\` ON \`integration_tenant\``);
		await queryRunner.query(`DROP TABLE \`integration_tenant\``);
		await queryRunner.query(`DROP INDEX \`IDX_34daf030004ad37b88f1f3d863\` ON \`integration_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_369eaafb13afe9903a170077ed\` ON \`integration_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_954c6b05297814776d9cb66ca7\` ON \`integration_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_f515574f1251562c52fe25b6a3\` ON \`integration_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_97c0d54aae21ccdbb5c3581642\` ON \`integration_setting\``);
		await queryRunner.query(`DROP TABLE \`integration_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_c327ea26bda3d349a1eceb5658\` ON \`integration_map\``);
		await queryRunner.query(`DROP INDEX \`IDX_7022dafd72c1b92f7d50691441\` ON \`integration_map\``);
		await queryRunner.query(`DROP INDEX \`IDX_eec3d6064578610ddc609dd360\` ON \`integration_map\``);
		await queryRunner.query(`DROP INDEX \`IDX_e63f4791631e7572ca213ac4a4\` ON \`integration_map\``);
		await queryRunner.query(`DROP INDEX \`IDX_c79464c4ccf7e5195d69675c15\` ON \`integration_map\``);
		await queryRunner.query(`DROP TABLE \`integration_map\``);
		await queryRunner.query(`DROP INDEX \`IDX_f80ff4ebbf0b33a67dce598911\` ON \`integration_entity_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_c6c01e38eebd8b26b9214b9044\` ON \`integration_entity_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_23e9cfcf1bfff07dcc3254378d\` ON \`integration_entity_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_1c653ebceca3b9c8766131db91\` ON \`integration_entity_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_e3d407c5532edaceaa4df34623\` ON \`integration_entity_setting\``);
		await queryRunner.query(`DROP TABLE \`integration_entity_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_3fb863167095805e33f38a0fdc\` ON \`integration_entity_setting_tied\``);
		await queryRunner.query(`DROP INDEX \`IDX_d5ac36aa3d5919908414154fca\` ON \`integration_entity_setting_tied\``);
		await queryRunner.query(`DROP INDEX \`IDX_b208a754c7a538cb3422f39f5b\` ON \`integration_entity_setting_tied\``);
		await queryRunner.query(`DROP INDEX \`IDX_101cd83aa75949cfb5b8eec084\` ON \`integration_entity_setting_tied\``);
		await queryRunner.query(`DROP INDEX \`IDX_6d43cc33c80221dbe4854b38e6\` ON \`integration_entity_setting_tied\``);
		await queryRunner.query(`DROP TABLE \`integration_entity_setting_tied\``);
		await queryRunner.query(`DROP INDEX \`IDX_29fbd3a17710a27e6f856072c0\` ON \`income\``);
		await queryRunner.query(`DROP INDEX \`IDX_a05d52b7ffe89140f9cbcf114b\` ON \`income\``);
		await queryRunner.query(`DROP INDEX \`IDX_20207d9f915066dfbc2210bcf1\` ON \`income\``);
		await queryRunner.query(`DROP INDEX \`IDX_86b5a121b3775a1b0b7fa75680\` ON \`income\``);
		await queryRunner.query(`DROP INDEX \`IDX_bd39a647a2843177723ddf733e\` ON \`income\``);
		await queryRunner.query(`DROP INDEX \`IDX_64409de4711cd14e2c43371cc0\` ON \`income\``);
		await queryRunner.query(`DROP INDEX \`IDX_8608b275644cfc7a0f3f585081\` ON \`income\``);
		await queryRunner.query(`DROP INDEX \`IDX_aedb8b1d10c498309bed9edf53\` ON \`income\``);
		await queryRunner.query(`DROP INDEX \`IDX_904ab9ee6ac5e74bf3616c8ccb\` ON \`income\``);
		await queryRunner.query(`DROP TABLE \`income\``);
		await queryRunner.query(`DROP INDEX \`IDX_d3675304df9971cccf96d9a7c3\` ON \`image_asset\``);
		await queryRunner.query(`DROP INDEX \`IDX_01856a9a730b7e79d70aa661cb\` ON \`image_asset\``);
		await queryRunner.query(`DROP INDEX \`IDX_af1a212cb378bb0eed51c1b2bc\` ON \`image_asset\``);
		await queryRunner.query(`DROP INDEX \`IDX_9d44ce9eb8689e578b941a6a54\` ON \`image_asset\``);
		await queryRunner.query(`DROP TABLE \`image_asset\``);
		await queryRunner.query(`DROP INDEX \`IDX_4c8b4e887a994182fd6132e640\` ON \`goal\``);
		await queryRunner.query(`DROP INDEX \`IDX_af0a11734e70412b742ac339c8\` ON \`goal\``);
		await queryRunner.query(`DROP INDEX \`IDX_35526ff1063ab5fa2b20e71bd6\` ON \`goal\``);
		await queryRunner.query(`DROP INDEX \`IDX_ac161c1a0c0ff8e83554f097e5\` ON \`goal\``);
		await queryRunner.query(`DROP INDEX \`IDX_c6e8ae55a4db3584686cbf6afe\` ON \`goal\``);
		await queryRunner.query(`DROP INDEX \`IDX_6b4758a5442713070c9a366d0e\` ON \`goal\``);
		await queryRunner.query(`DROP INDEX \`IDX_4a2c00a44350a063d75be80ba9\` ON \`goal\``);
		await queryRunner.query(`DROP INDEX \`IDX_72641ffde44e1a1627aa2d040f\` ON \`goal\``);
		await queryRunner.query(`DROP TABLE \`goal\``);
		await queryRunner.query(`DROP INDEX \`IDX_405bc5bba9ed71aefef84a29f1\` ON \`goal_time_frame\``);
		await queryRunner.query(`DROP INDEX \`IDX_b56723b53a76ca1c171890c479\` ON \`goal_time_frame\``);
		await queryRunner.query(`DROP INDEX \`IDX_ef4ec26ca3a7e0d8c9e1748be2\` ON \`goal_time_frame\``);
		await queryRunner.query(`DROP INDEX \`IDX_646565982726362cc2ca4fb807\` ON \`goal_time_frame\``);
		await queryRunner.query(`DROP TABLE \`goal_time_frame\``);
		await queryRunner.query(`DROP INDEX \`IDX_5708fe06608c72fc77b65ae651\` ON \`goal_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_774bf82989475befe301fe1bca\` ON \`goal_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_056e869152a335f88c38c5b693\` ON \`goal_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_cd91c5925942061527b1bc112c\` ON \`goal_template\``);
		await queryRunner.query(`DROP TABLE \`goal_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_d4f093ca4eb7c40db68d9a789d\` ON \`goal_kpi\``);
		await queryRunner.query(`DROP INDEX \`IDX_e49e37fe88a2725a38a3b05849\` ON \`goal_kpi\``);
		await queryRunner.query(`DROP INDEX \`IDX_43aa2985216560cd9fa93f501e\` ON \`goal_kpi\``);
		await queryRunner.query(`DROP INDEX \`IDX_a96c22c51607f878c8a98bc488\` ON \`goal_kpi\``);
		await queryRunner.query(`DROP INDEX \`IDX_cfc393bd9835d8259e73019226\` ON \`goal_kpi\``);
		await queryRunner.query(`DROP TABLE \`goal_kpi\``);
		await queryRunner.query(`DROP INDEX \`IDX_df7ab026698c02859ff7540809\` ON \`goal_kpi_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_cc72d4e8e4284dcc8ffbf96caf\` ON \`goal_kpi_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_26311c417ba945c901c65d515d\` ON \`goal_kpi_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_b4f4701ddb0e973602445ed1c6\` ON \`goal_kpi_template\``);
		await queryRunner.query(`DROP TABLE \`goal_kpi_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_e35d0f7b794ca8850669d12c78\` ON \`goal_general_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_d17a5159d888ac6320459eda39\` ON \`goal_general_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_4a44905db4ca1e40b62021fdfb\` ON \`goal_general_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_bdee8704ebeb79368ff6154fc7\` ON \`goal_general_setting\``);
		await queryRunner.query(`DROP TABLE \`goal_general_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_d4a28a8e70d450a412bf0cfb52\` ON \`feature\``);
		await queryRunner.query(`DROP INDEX \`IDX_c30465b5a6e0fae1c8ee7e3120\` ON \`feature\``);
		await queryRunner.query(`DROP INDEX \`IDX_4832be692a2dc63d67e8e93c75\` ON \`feature\``);
		await queryRunner.query(`DROP INDEX \`IDX_a26cc341268d22bd55f06e3ef6\` ON \`feature\``);
		await queryRunner.query(`DROP INDEX \`IDX_5405b67f1df904831a358df7c4\` ON \`feature\``);
		await queryRunner.query(`DROP TABLE \`feature\``);
		await queryRunner.query(`DROP INDEX \`IDX_6d413f9fdd5366b1b9add46483\` ON \`feature_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_6a94e6b0a572f591288ac44a42\` ON \`feature_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_8f71803d96dcdbcc6b19bb28d3\` ON \`feature_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_e4c142f37091b47056012d34ba\` ON \`feature_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_4ee685760ddb60ff71f763d8f6\` ON \`feature_organization\``);
		await queryRunner.query(`DROP TABLE \`feature_organization\``);
		await queryRunner.query(`DROP INDEX \`IDX_a43b235c35c2c4d3263ada770c\` ON \`import-record\``);
		await queryRunner.query(`DROP INDEX \`IDX_339328a7247aa09d061c642ae1\` ON \`import-record\``);
		await queryRunner.query(`DROP INDEX \`IDX_b90957ef81e74c43d6ae037560\` ON \`import-record\``);
		await queryRunner.query(`DROP TABLE \`import-record\``);
		await queryRunner.query(`DROP INDEX \`IDX_54868607115e2fee3b0b764eec\` ON \`import-history\``);
		await queryRunner.query(`DROP INDEX \`IDX_d6a626bee6cddf4bc53a493bc3\` ON \`import-history\``);
		await queryRunner.query(`DROP INDEX \`IDX_e339340014a6c4e2f57be00b0c\` ON \`import-history\``);
		await queryRunner.query(`DROP TABLE \`import-history\``);
		await queryRunner.query(`DROP INDEX \`IDX_047b8b5c0782d5a6d4c8bfc1a4\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_9971c4171ae051e74b833984a3\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_42eea5debc63f4d1bf89881c10\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_eacb116ab0521ad9b96f2bb53b\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_5e7b197dbac69012dbdb4964f3\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_5f57d077c28b378a6c885e81c5\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_97ed0e2b80f2e7ec260fd81cd9\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_0006d3025b6c92fbd4089b9465\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_dd8ab9312fb8d787982b9feebf\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_cbfebdb1419f9b8036a8b0546e\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_89508d119b1a279c037d9da151\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_3826d6ca74a08a8498fa17d330\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_b5bb8f62d401475fcc8c2ba35e\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_846a933af451a33b95b7b198c6\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_c5fb146726ff128e600f23d0a1\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_6d171c9d5f81095436b99da5e6\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_d77aeb93f2439ebdf4babaab4c\` ON \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_1aa0e5fd480214ae4851471e3c\` ON \`expense\``);
		await queryRunner.query(`DROP TABLE \`expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_9c9bfe5baaf83f53533ff035fc\` ON \`expense_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_37504e920ee5ca46a4000b89da\` ON \`expense_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_e9cef5d359dfa48ee5d0cd5fcc\` ON \`expense_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_8376e41fd82aba147a433dc097\` ON \`expense_category\``);
		await queryRunner.query(`DROP TABLE \`expense_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_24d905ec9e127ade23754a363d\` ON \`event_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_5bde7aeb2c7fb3a421b175871e\` ON \`event_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_43459c650957e478203c738574\` ON \`event_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_9d5980ff1064e2edb77509d312\` ON \`event_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_4b02d8616129f39fca2b10e98b\` ON \`event_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_fc8818d6fde74370ec703a0135\` ON \`event_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_92fc62260c0c7ff108622850bf\` ON \`event_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_613cfa5783e164cad10dc27e58\` ON \`event_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_f14eee32875b112fab1139b332\` ON \`event_type\``);
		await queryRunner.query(`DROP TABLE \`event_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_233c1d351d63441aeb039d1164\` ON \`estimate_email\``);
		await queryRunner.query(`DROP INDEX \`IDX_391d3f83244fea73c619aecadd\` ON \`estimate_email\``);
		await queryRunner.query(`DROP INDEX \`IDX_f1fac79e17c475f00daa4db3d2\` ON \`estimate_email\``);
		await queryRunner.query(`DROP INDEX \`IDX_1a4bd2a8034bb1309b4ea87882\` ON \`estimate_email\``);
		await queryRunner.query(`DROP TABLE \`estimate_email\``);
		await queryRunner.query(`DROP INDEX \`IDX_f98ce0d210aa9f91b729d44780\` ON \`equipment\``);
		await queryRunner.query(`DROP INDEX \`IDX_fb6808468066849ab7b7454d5f\` ON \`equipment\``);
		await queryRunner.query(`DROP INDEX \`IDX_d8452bfe9f18ced4ce76c4b70b\` ON \`equipment\``);
		await queryRunner.query(`DROP INDEX \`IDX_39e1b443404ea7fa42b3d36ccb\` ON \`equipment\``);
		await queryRunner.query(`DROP TABLE \`equipment\``);
		await queryRunner.query(`DROP INDEX \`IDX_0ecfe0ce0cd2b197249d5f1c10\` ON \`equipment_sharing\``);
		await queryRunner.query(`DROP INDEX \`IDX_acad51a6362806fc499e583e40\` ON \`equipment_sharing\``);
		await queryRunner.query(`DROP INDEX \`IDX_ea9254be07ae4a8604f0aaab19\` ON \`equipment_sharing\``);
		await queryRunner.query(`DROP INDEX \`IDX_fa525e61fb3d8d9efec0f364a4\` ON \`equipment_sharing\``);
		await queryRunner.query(`DROP INDEX \`IDX_a734598f5637cf1501288331e3\` ON \`equipment_sharing\``);
		await queryRunner.query(`DROP INDEX \`IDX_70ff31cefa0f578f6fa82d2bcc\` ON \`equipment_sharing\``);
		await queryRunner.query(`DROP TABLE \`equipment_sharing\``);
		await queryRunner.query(`DROP INDEX \`IDX_04c9e514ed70897f6ad8cadc3c\` ON \`equipment_sharing_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_5311a833ff255881454bd5b3b5\` ON \`equipment_sharing_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_5443ca8ed830626656d8cfecef\` ON \`equipment_sharing_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_b0fc293cf47f31ba512fd29bf0\` ON \`equipment_sharing_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_0f3ee47a5fb7192d5eb00c71ae\` ON \`equipment_sharing_policy\``);
		await queryRunner.query(`DROP TABLE \`equipment_sharing_policy\``);
		await queryRunner.query(`DROP INDEX \`REL_1c0c1370ecd98040259625e17e\` ON \`employee\``);
		await queryRunner.query(`DROP INDEX \`REL_f4b0d329c4a3cf79ffe9d56504\` ON \`employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_5e719204dcafa8d6b2ecdeda13\` ON \`employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_1c0c1370ecd98040259625e17e\` ON \`employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_f4b0d329c4a3cf79ffe9d56504\` ON \`employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_96dfbcaa2990df01fe5bb39ccc\` ON \`employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_c6a48286f3aa8ae903bee0d1e7\` ON \`employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_4b3303a6b7eb92d237a4379734\` ON \`employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_175b7be641928a31521224daa8\` ON \`employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_510cb87f5da169e57e694d1a5c\` ON \`employee\``);
		await queryRunner.query(`DROP TABLE \`employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_95ea18af6ef8123503d332240c\` ON \`employee_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_710c71526edb89b2a7033abcdf\` ON \`employee_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_9537fae454ebebc98ee5adb3a2\` ON \`employee_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_56e96cd218a185ed59b5a8e786\` ON \`employee_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_9516a627a131626d2a5738a05a\` ON \`employee_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_01237d04f882cf1ea794678e8d\` ON \`employee_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_48fae30026b4e166a3445fee6d\` ON \`employee_setting\``);
		await queryRunner.query(`DROP TABLE \`employee_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_0ac8526c48a3daa267c86225fb\` ON \`employee_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_6e570174fda71e97616e9d2eea\` ON \`employee_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_739f8cdce21cc72d400559ce00\` ON \`employee_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_a4b5a2ea2afecf1ee254f1a704\` ON \`employee_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_3ee5147bb1fde625fa33c0e956\` ON \`employee_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_5fde7be40b3c03bc0fdac0c2f6\` ON \`employee_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_3980b0fe1e757b092ea5323656\` ON \`employee_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_25f8915182128f377d84b60d26\` ON \`employee_recurring_expense\``);
		await queryRunner.query(`DROP TABLE \`employee_recurring_expense\``);
		await queryRunner.query(`DROP INDEX \`IDX_2be728a7f8b118712a4200990d\` ON \`employee_proposal_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_a13f3564eae9db44ddc4308afc\` ON \`employee_proposal_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_0111963c9cb4dd14565c0d9c84\` ON \`employee_proposal_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_dc2ff85f7de16dea6453a833dd\` ON \`employee_proposal_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_ee780fbd8f91de31c004929eec\` ON \`employee_proposal_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_f577c9bc6183c1d1eae1e154bb\` ON \`employee_proposal_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_e396663e1a31114eac39087829\` ON \`employee_proposal_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_2bb17670e2bea3980ff960bbcf\` ON \`employee_proposal_template\``);
		await queryRunner.query(`DROP TABLE \`employee_proposal_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_329ebd01a757d1a0c3c4d628e2\` ON \`employee_phone\``);
		await queryRunner.query(`DROP INDEX \`IDX_ba7b2ef5a9cd165a1e4e2ad0ef\` ON \`employee_phone\``);
		await queryRunner.query(`DROP INDEX \`IDX_0f9cefa604913e1ab322591546\` ON \`employee_phone\``);
		await queryRunner.query(`DROP INDEX \`IDX_d543336994b1f764c449e0b1d3\` ON \`employee_phone\``);
		await queryRunner.query(`DROP INDEX \`IDX_aa98ea786d490db300d3dbbdb6\` ON \`employee_phone\``);
		await queryRunner.query(`DROP INDEX \`IDX_587d11ffbd87adb6dff367f3cd\` ON \`employee_phone\``);
		await queryRunner.query(`DROP TABLE \`employee_phone\``);
		await queryRunner.query(`DROP INDEX \`IDX_c4668533292bf4526e61aedf74\` ON \`employee_level\``);
		await queryRunner.query(`DROP INDEX \`IDX_d3fc52d497bc44d6f493dbedc3\` ON \`employee_level\``);
		await queryRunner.query(`DROP INDEX \`IDX_88a58d149404145ed7b3385387\` ON \`employee_level\``);
		await queryRunner.query(`DROP INDEX \`IDX_90bd442869709bae9d1b18e489\` ON \`employee_level\``);
		await queryRunner.query(`DROP TABLE \`employee_level\``);
		await queryRunner.query(`DROP INDEX \`IDX_c8723c90a6f007f8d7e882a04f\` ON \`job_search_occupation\``);
		await queryRunner.query(`DROP INDEX \`IDX_cb64573b18dd7b23f591f15502\` ON \`job_search_occupation\``);
		await queryRunner.query(`DROP INDEX \`IDX_9f1288205ae91f91cf356cac2f\` ON \`job_search_occupation\``);
		await queryRunner.query(`DROP INDEX \`IDX_1a62a99e1016e4a2b461e886ec\` ON \`job_search_occupation\``);
		await queryRunner.query(`DROP INDEX \`IDX_44e22d88b47daf2095491b7cac\` ON \`job_search_occupation\``);
		await queryRunner.query(`DROP INDEX \`IDX_e4bc75a1cbb07d117a0acfcdba\` ON \`job_search_occupation\``);
		await queryRunner.query(`DROP INDEX \`IDX_4b8450a24233df8b47ca472923\` ON \`job_search_occupation\``);
		await queryRunner.query(`DROP TABLE \`job_search_occupation\``);
		await queryRunner.query(`DROP INDEX \`IDX_6ee5218c869b57197e4a209bed\` ON \`job_search_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_d0a798419c775b9157bf0269f4\` ON \`job_search_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_3b335bbcbf7d5e00853acaa165\` ON \`job_search_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_86381fb6d28978b101b3aec8ca\` ON \`job_search_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_35e120f2b6e5188391cf068d3b\` ON \`job_search_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_015231c6e28cfb2b789ca4b76f\` ON \`job_search_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_36333846c37e5f8812a5c9f7ff\` ON \`job_search_category\``);
		await queryRunner.query(`DROP TABLE \`job_search_category\``);
		await queryRunner.query(`DROP INDEX \`IDX_f2c1b6770dd2a3abfa35f49411\` ON \`job_preset\``);
		await queryRunner.query(`DROP INDEX \`IDX_a4b038417e3221c0791dd8c771\` ON \`job_preset\``);
		await queryRunner.query(`DROP INDEX \`IDX_7e53ea80aca15da11a8a5ec038\` ON \`job_preset\``);
		await queryRunner.query(`DROP INDEX \`IDX_e210f70c3904cf84ab5113be8f\` ON \`job_preset\``);
		await queryRunner.query(`DROP INDEX \`IDX_46226c3185e3ca3d7033831d7a\` ON \`job_preset\``);
		await queryRunner.query(`DROP TABLE \`job_preset\``);
		await queryRunner.query(
			`DROP INDEX \`IDX_d5ca48cfacfb516543d6507ca4\` ON \`job_preset_upwork_job_search_criterion\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_2323220b4decfd2f4d8307fd78\` ON \`job_preset_upwork_job_search_criterion\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_4070b6f3480e9c4b2dcf3f7b56\` ON \`job_preset_upwork_job_search_criterion\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_af850e1fa48af82d66e9bf81c7\` ON \`job_preset_upwork_job_search_criterion\``
		);
		await queryRunner.query(`DROP TABLE \`job_preset_upwork_job_search_criterion\``);
		await queryRunner.query(
			`DROP INDEX \`IDX_630337302efe97cc93deeb2151\` ON \`employee_upwork_job_search_criterion\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_afe6c40d3d9951388fa05f83f2\` ON \`employee_upwork_job_search_criterion\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_0e130a25bb4abe1b27c8a0adf4\` ON \`employee_upwork_job_search_criterion\``
		);
		await queryRunner.query(
			`DROP INDEX \`IDX_6bae61744663a416e73903d9af\` ON \`employee_upwork_job_search_criterion\``
		);
		await queryRunner.query(`DROP TABLE \`employee_upwork_job_search_criterion\``);
		await queryRunner.query(`DROP INDEX \`IDX_0c5266f3f488add404f92d56ec\` ON \`employee_award\``);
		await queryRunner.query(`DROP INDEX \`IDX_6912685bbb0e303eab392978d9\` ON \`employee_award\``);
		await queryRunner.query(`DROP INDEX \`IDX_caf8363b0ed7d5f24ae866ba3b\` ON \`employee_award\``);
		await queryRunner.query(`DROP INDEX \`IDX_91e0f7efcd17d20b5029fb1342\` ON \`employee_award\``);
		await queryRunner.query(`DROP INDEX \`IDX_8fb47e8bfd26340ddaeabd24e5\` ON \`employee_award\``);
		await queryRunner.query(`DROP INDEX \`IDX_c07390f325c847be7df93d0d17\` ON \`employee_award\``);
		await queryRunner.query(`DROP TABLE \`employee_award\``);
		await queryRunner.query(`DROP INDEX \`IDX_86cf36c137712e779dd7e2301e\` ON \`employee_appointment\``);
		await queryRunner.query(`DROP INDEX \`IDX_a35637bb659c59e18adb4f38f8\` ON \`employee_appointment\``);
		await queryRunner.query(`DROP INDEX \`IDX_64c83df9d37d9ada96edb66557\` ON \`employee_appointment\``);
		await queryRunner.query(`DROP INDEX \`IDX_d0219ada2359ede9e7b0d511ba\` ON \`employee_appointment\``);
		await queryRunner.query(`DROP TABLE \`employee_appointment\``);
		await queryRunner.query(`DROP INDEX \`IDX_7e688e6613930ba721b841db43\` ON \`email_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_274708db64fcce5448f2c4541c\` ON \`email_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_c160fe6234675fac031aa3e7c5\` ON \`email_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_753e005a45556b5909e11937aa\` ON \`email_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_29d60114e1968c0cd68a19e3c5\` ON \`email_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_e4932e0a726b9b07d81d8b6905\` ON \`email_template\``);
		await queryRunner.query(`DROP TABLE \`email_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_e37af4ab2ba0bf268bfd982634\` ON \`email_reset\``);
		await queryRunner.query(`DROP INDEX \`IDX_4ac734f2a1a3c055dca04fba99\` ON \`email_reset\``);
		await queryRunner.query(`DROP INDEX \`IDX_9e80c9ec749dfda6dbe2cd9704\` ON \`email_reset\``);
		await queryRunner.query(`DROP INDEX \`IDX_4be518a169bbcbfe92025ac574\` ON \`email_reset\``);
		await queryRunner.query(`DROP INDEX \`IDX_03d16a2fd43d7c601743440212\` ON \`email_reset\``);
		await queryRunner.query(`DROP INDEX \`IDX_93799dfaeff51de06f1e02ac41\` ON \`email_reset\``);
		await queryRunner.query(`DROP INDEX \`IDX_13247a755d17e7905d5bb4cfda\` ON \`email_reset\``);
		await queryRunner.query(`DROP INDEX \`IDX_e3321e3575289b7ee1e8eb1042\` ON \`email_reset\``);
		await queryRunner.query(`DROP TABLE \`email_reset\``);
		await queryRunner.query(`DROP INDEX \`IDX_5956ce758c01ebf8a539e8d4f0\` ON \`email_sent\``);
		await queryRunner.query(`DROP INDEX \`IDX_9033faf41b23c61ba201c48796\` ON \`email_sent\``);
		await queryRunner.query(`DROP INDEX \`IDX_1261c457b3035b77719556995b\` ON \`email_sent\``);
		await queryRunner.query(`DROP INDEX \`IDX_a954fda57cca81dc48446e73b8\` ON \`email_sent\``);
		await queryRunner.query(`DROP INDEX \`IDX_953df0eb0df3035baf140399f6\` ON \`email_sent\``);
		await queryRunner.query(`DROP INDEX \`IDX_525f4873c6edc3d94559f88900\` ON \`email_sent\``);
		await queryRunner.query(`DROP INDEX \`IDX_0af511c44de7a16beb45cc3785\` ON \`email_sent\``);
		await queryRunner.query(`DROP INDEX \`IDX_9a69f7077e0333d2c848895a1b\` ON \`email_sent\``);
		await queryRunner.query(`DROP INDEX \`IDX_d825bc6da1c52a3900a9373260\` ON \`email_sent\``);
		await queryRunner.query(`DROP TABLE \`email_sent\``);
		await queryRunner.query(`DROP INDEX \`REL_1ae3abc0ae1dcf6c13f49b62b5\` ON \`deal\``);
		await queryRunner.query(`DROP INDEX \`IDX_9211f5b62988df6e95522be7da\` ON \`deal\``);
		await queryRunner.query(`DROP INDEX \`IDX_4b1ff44e6bae5065429dbab554\` ON \`deal\``);
		await queryRunner.query(`DROP INDEX \`IDX_38fb85abdf9995efcf217f5955\` ON \`deal\``);
		await queryRunner.query(`DROP INDEX \`IDX_46a3c00bfc3e36b4412d8bcdb0\` ON \`deal\``);
		await queryRunner.query(`DROP INDEX \`IDX_443c561d45f6c57f3790a759ba\` ON \`deal\``);
		await queryRunner.query(`DROP INDEX \`IDX_0d8c964237e5061627de82df80\` ON \`deal\``);
		await queryRunner.query(`DROP TABLE \`deal\``);
		await queryRunner.query(`DROP INDEX \`IDX_15a1306132d66c63ef31f7288c\` ON \`custom_smtp\``);
		await queryRunner.query(`DROP INDEX \`IDX_2aa3fc8daa25beec4788d2be26\` ON \`custom_smtp\``);
		await queryRunner.query(`DROP INDEX \`IDX_f10372f9d038d0954d5b20635a\` ON \`custom_smtp\``);
		await queryRunner.query(`DROP INDEX \`IDX_e2c7d28bb07adc915d74437c7b\` ON \`custom_smtp\``);
		await queryRunner.query(`DROP TABLE \`custom_smtp\``);
		await queryRunner.query(`DROP INDEX \`IDX_0b0fbda74f6c82c943e706a3cc\` ON \`currency\``);
		await queryRunner.query(`DROP INDEX \`IDX_8203f1410475748bbbc6d3029d\` ON \`currency\``);
		await queryRunner.query(`DROP INDEX \`IDX_03cc024ddc2f196dca7fead7cb\` ON \`currency\``);
		await queryRunner.query(`DROP TABLE \`currency\``);
		await queryRunner.query(`DROP INDEX \`IDX_6eba1a52ee121d100c8a0a6510\` ON \`country\``);
		await queryRunner.query(`DROP INDEX \`IDX_6cd9b7ea6818e862217035436c\` ON \`country\``);
		await queryRunner.query(`DROP INDEX \`IDX_97ebcd8db30a408b5f907d6ff4\` ON \`country\``);
		await queryRunner.query(`DROP TABLE \`country\``);
		await queryRunner.query(`DROP INDEX \`IDX_7719d73cd16a9f57ecc6ac24b3\` ON \`contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_60468af1ce34043a900809c84f\` ON \`contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_4164bd34bdcce8754641f0e567\` ON \`contact\``);
		await queryRunner.query(`DROP INDEX \`IDX_05831d37eabeb6150f99c69784\` ON \`contact\``);
		await queryRunner.query(`DROP TABLE \`contact\``);
		await queryRunner.query(`DROP INDEX \`REL_8b900e8a39f76125e610ab30c0\` ON \`candidate\``);
		await queryRunner.query(`DROP INDEX \`REL_3930aa71e0fa24f09201811b1b\` ON \`candidate\``);
		await queryRunner.query(`DROP INDEX \`REL_4ea108fd8b089237964d5f98fb\` ON \`candidate\``);
		await queryRunner.query(`DROP INDEX \`REL_b674793a804b7d69d74c8f6c5b\` ON \`candidate\``);
		await queryRunner.query(`DROP INDEX \`IDX_8b900e8a39f76125e610ab30c0\` ON \`candidate\``);
		await queryRunner.query(`DROP INDEX \`IDX_3930aa71e0fa24f09201811b1b\` ON \`candidate\``);
		await queryRunner.query(`DROP INDEX \`IDX_4ea108fd8b089237964d5f98fb\` ON \`candidate\``);
		await queryRunner.query(`DROP INDEX \`IDX_1e3e8228e7df634fa4cec6322c\` ON \`candidate\``);
		await queryRunner.query(`DROP INDEX \`IDX_b674793a804b7d69d74c8f6c5b\` ON \`candidate\``);
		await queryRunner.query(`DROP INDEX \`IDX_16fb27ffd1a99c6506c92ad57a\` ON \`candidate\``);
		await queryRunner.query(`DROP INDEX \`IDX_77ac426e04553ff1654421bce4\` ON \`candidate\``);
		await queryRunner.query(`DROP INDEX \`IDX_af835b66fa10279103bd89e225\` ON \`candidate\``);
		await queryRunner.query(`DROP INDEX \`IDX_2b8091376a529383e23ba3356a\` ON \`candidate\``);
		await queryRunner.query(`DROP TABLE \`candidate\``);
		await queryRunner.query(`DROP INDEX \`IDX_063663c7e61e45d172d1b83265\` ON \`candidate_technology\``);
		await queryRunner.query(`DROP INDEX \`IDX_9d46b8c5382acd4d4514bc5c62\` ON \`candidate_technology\``);
		await queryRunner.query(`DROP INDEX \`IDX_a6fecb615b07987b480defac64\` ON \`candidate_technology\``);
		await queryRunner.query(`DROP INDEX \`IDX_97aa0328b72e1bf919e61bccdc\` ON \`candidate_technology\``);
		await queryRunner.query(`DROP INDEX \`IDX_199ca43300fa4e64239656a677\` ON \`candidate_technology\``);
		await queryRunner.query(`DROP TABLE \`candidate_technology\``);
		await queryRunner.query(`DROP INDEX \`IDX_e92027b5280828cadd7cd6ea71\` ON \`candidate_source\``);
		await queryRunner.query(`DROP INDEX \`IDX_b2a1ba27a76dd819cd8294cce3\` ON \`candidate_source\``);
		await queryRunner.query(`DROP INDEX \`IDX_509101ab1a46a5934ee278d447\` ON \`candidate_source\``);
		await queryRunner.query(`DROP INDEX \`IDX_2be9182096747fb18cb8afb1f0\` ON \`candidate_source\``);
		await queryRunner.query(`DROP TABLE \`candidate_source\``);
		await queryRunner.query(`DROP INDEX \`IDX_d7986743e7f11720349a6c9557\` ON \`candidate_skill\``);
		await queryRunner.query(`DROP INDEX \`IDX_8a07f780c6fce2b82830ab0687\` ON \`candidate_skill\``);
		await queryRunner.query(`DROP INDEX \`IDX_a38fe0c3f2ff0a4e475f2a1347\` ON \`candidate_skill\``);
		await queryRunner.query(`DROP INDEX \`IDX_6907163d0bb8e9f0440b9bf2a7\` ON \`candidate_skill\``);
		await queryRunner.query(`DROP TABLE \`candidate_skill\``);
		await queryRunner.query(`DROP INDEX \`IDX_a0d171f45bdbcf2b990c0c37c3\` ON \`candidate_personal_quality\``);
		await queryRunner.query(`DROP INDEX \`IDX_d321f4547ed467d07cce1e7d9a\` ON \`candidate_personal_quality\``);
		await queryRunner.query(`DROP INDEX \`IDX_045de7c208adcd0c68c0a65174\` ON \`candidate_personal_quality\``);
		await queryRunner.query(`DROP INDEX \`IDX_ff6776d92db4ef71edbfba9903\` ON \`candidate_personal_quality\``);
		await queryRunner.query(`DROP INDEX \`IDX_afe01503d4337c9623c06f22df\` ON \`candidate_personal_quality\``);
		await queryRunner.query(`DROP TABLE \`candidate_personal_quality\``);
		await queryRunner.query(`DROP INDEX \`IDX_9e7b20eb3dfa082b83b198fdad\` ON \`candidate_interviewer\``);
		await queryRunner.query(`DROP INDEX \`IDX_ecb65075e94b47bbab11cfa5a1\` ON \`candidate_interviewer\``);
		await queryRunner.query(`DROP INDEX \`IDX_5f1e315db848990dfffa72817c\` ON \`candidate_interviewer\``);
		await queryRunner.query(`DROP INDEX \`IDX_f0ca69c78eea92c95d9044764a\` ON \`candidate_interviewer\``);
		await queryRunner.query(`DROP INDEX \`IDX_2043abff09f084fb8690009fb8\` ON \`candidate_interviewer\``);
		await queryRunner.query(`DROP INDEX \`IDX_b9132118c3a98c4c48e417c0c5\` ON \`candidate_interviewer\``);
		await queryRunner.query(`DROP TABLE \`candidate_interviewer\``);
		await queryRunner.query(`DROP INDEX \`IDX_91996439c4baafee8395d3df15\` ON \`candidate_interview\``);
		await queryRunner.query(`DROP INDEX \`IDX_03be41e88b1fecfe4e24d6b04b\` ON \`candidate_interview\``);
		await queryRunner.query(`DROP INDEX \`IDX_59b765e6d13d83dba4852a43eb\` ON \`candidate_interview\``);
		await queryRunner.query(`DROP INDEX \`IDX_7b49ce2928b327213f2de66b95\` ON \`candidate_interview\``);
		await queryRunner.query(`DROP INDEX \`IDX_b9191cf49f8cd1f192cb74233c\` ON \`candidate_interview\``);
		await queryRunner.query(`DROP TABLE \`candidate_interview\``);
		await queryRunner.query(`DROP INDEX \`REL_44f3d80c3293e1de038c87f115\` ON \`candidate_feedback\``);
		await queryRunner.query(`DROP INDEX \`IDX_0862c274d336126b951bfe009a\` ON \`candidate_feedback\``);
		await queryRunner.query(`DROP INDEX \`IDX_98c008fd8cf597e83dcdccfd16\` ON \`candidate_feedback\``);
		await queryRunner.query(`DROP INDEX \`IDX_3a6928f8501fce33820721a8fe\` ON \`candidate_feedback\``);
		await queryRunner.query(`DROP INDEX \`IDX_6cb21fa0f65ff69679966c836f\` ON \`candidate_feedback\``);
		await queryRunner.query(`DROP INDEX \`IDX_05ed49a5ebdd5ec533f913b620\` ON \`candidate_feedback\``);
		await queryRunner.query(`DROP INDEX \`IDX_c660aef2ca5aff9dbf45a9a4bb\` ON \`candidate_feedback\``);
		await queryRunner.query(`DROP TABLE \`candidate_feedback\``);
		await queryRunner.query(`DROP INDEX \`IDX_a50eb955f940ca93e044d175c6\` ON \`candidate_experience\``);
		await queryRunner.query(`DROP INDEX \`IDX_8dcf5fc8bc7f77a80b0fc648bf\` ON \`candidate_experience\``);
		await queryRunner.query(`DROP INDEX \`IDX_c24bce6dd33e56ef8e8dacef1a\` ON \`candidate_experience\``);
		await queryRunner.query(`DROP INDEX \`IDX_dafa68d060cf401d5f62a57ad4\` ON \`candidate_experience\``);
		await queryRunner.query(`DROP TABLE \`candidate_experience\``);
		await queryRunner.query(`DROP INDEX \`IDX_f660af89b2c69fea2334508cbb\` ON \`candidate_education\``);
		await queryRunner.query(`DROP INDEX \`IDX_00cdd9ed7571be8e2c8d09e7cd\` ON \`candidate_education\``);
		await queryRunner.query(`DROP INDEX \`IDX_b443c78c3796f2e9aab05a2bb9\` ON \`candidate_education\``);
		await queryRunner.query(`DROP INDEX \`IDX_336eb14606016757d2302efa4d\` ON \`candidate_education\``);
		await queryRunner.query(`DROP TABLE \`candidate_education\``);
		await queryRunner.query(`DROP INDEX \`IDX_3f9053719c9d11ebdea03e5a2d\` ON \`candidate_document\``);
		await queryRunner.query(`DROP INDEX \`IDX_d108a827199fda86a9ec216989\` ON \`candidate_document\``);
		await queryRunner.query(`DROP INDEX \`IDX_4d9b7ab09f9f9517d488b5fed1\` ON \`candidate_document\``);
		await queryRunner.query(`DROP INDEX \`IDX_3ed4bac12d0ca32eada4ea5a49\` ON \`candidate_document\``);
		await queryRunner.query(`DROP INDEX \`IDX_bf8070715e42b3afe9730e7b30\` ON \`candidate_document\``);
		await queryRunner.query(`DROP TABLE \`candidate_document\``);
		await queryRunner.query(`DROP INDEX \`IDX_159f821dd214792f1d2ad9cff7\` ON \`candidate_criterion_rating\``);
		await queryRunner.query(`DROP INDEX \`IDX_ba4c376b2069aa82745d4e9682\` ON \`candidate_criterion_rating\``);
		await queryRunner.query(`DROP INDEX \`IDX_d1d16bc87d3afaf387f34cdceb\` ON \`candidate_criterion_rating\``);
		await queryRunner.query(`DROP INDEX \`IDX_b106406e94bb7317493efc2c98\` ON \`candidate_criterion_rating\``);
		await queryRunner.query(`DROP INDEX \`IDX_9d5bd131452ef689df2b46551b\` ON \`candidate_criterion_rating\``);
		await queryRunner.query(`DROP INDEX \`IDX_fcab96cef60fd8bccac610ccef\` ON \`candidate_criterion_rating\``);
		await queryRunner.query(`DROP INDEX \`IDX_0a417dafb1dd14eb92a69fa641\` ON \`candidate_criterion_rating\``);
		await queryRunner.query(`DROP TABLE \`candidate_criterion_rating\``);
		await queryRunner.query(`DROP INDEX \`IDX_46ed3c2287423f5dc089100fee\` ON \`availability_slot\``);
		await queryRunner.query(`DROP INDEX \`IDX_d544bd3a63634a4438509ac958\` ON \`availability_slot\``);
		await queryRunner.query(`DROP INDEX \`IDX_f008a481cb4eed547704bb9d83\` ON \`availability_slot\``);
		await queryRunner.query(`DROP INDEX \`IDX_3aabb2cdf5b6e0df87cb94bdca\` ON \`availability_slot\``);
		await queryRunner.query(`DROP INDEX \`IDX_3e20b617c7d7a87b8bf53ddcbe\` ON \`availability_slot\``);
		await queryRunner.query(`DROP TABLE \`availability_slot\``);
		await queryRunner.query(`DROP INDEX \`IDX_45f32a5a12d42fba17fe62a279\` ON \`approval_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_dfe3b357df3ce136917b1f0984\` ON \`approval_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_1462391059ebe137645098d727\` ON \`approval_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_f50ce5a39d610cfcd9da9652b1\` ON \`approval_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_338364927c68961167606e989c\` ON \`approval_policy\``);
		await queryRunner.query(`DROP TABLE \`approval_policy\``);
		await queryRunner.query(`DROP INDEX \`IDX_e9ca170a0fae05e44a9bd137d8\` ON \`appointment_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_0ddc50b7521b9a905d9ca8c8ba\` ON \`appointment_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_3c3a62226896345c4716bfe1d9\` ON \`appointment_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_2c0494466d5a7e1165cea3dca9\` ON \`appointment_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_2a6f8c4b8da6f85e2903daf5c3\` ON \`appointment_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_379af16b0aeed6a4d8f15c53bc\` ON \`appointment_employee\``);
		await queryRunner.query(`DROP TABLE \`appointment_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_a841eabc6b656c965d8846223e\` ON \`accounting_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_968c1c9a131a61a3720b3a72f6\` ON \`accounting_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_e66511b175393255c6c4e7b007\` ON \`accounting_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_2ca6a49062a4ed884e413bf572\` ON \`accounting_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_7ac2c1c487dd77fe38c2d571ea\` ON \`accounting_template\``);
		await queryRunner.query(`DROP INDEX \`IDX_5cf7c007fc9c83bee748f08806\` ON \`accounting_template\``);
		await queryRunner.query(`DROP TABLE \`accounting_template\``);
	}
}
