import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateTableCamshots1749475704103 implements MigrationInterface {
	name = 'CreateTableCamshots1749475704103';

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
		console.log(chalk.yellow(this.name + ' reverting changes!'));

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
			`ALTER TABLE \`employee_job_preset\` DROP FOREIGN KEY \`FK_7ae5b4d4bdec77971dab319f2e2\``
		);
		await queryRunner.query(
			`CREATE TABLE \`camshots\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`title\` varchar(255) NOT NULL, \`fileKey\` varchar(255) NOT NULL, \`thumbKey\` varchar(255) NULL, \`storageProvider\` enum ('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN') NULL, \`recordedAt\` datetime NULL, \`fullUrl\` varchar(255) NULL, \`thumbUrl\` varchar(255) NULL, \`size\` int NULL, \`timeSlotId\` varchar(255) NULL, \`uploadedById\` varchar(255) NULL, \`userId\` varchar(255) NULL, INDEX \`IDX_b534f6f40427fa2e210503b42f\` (\`createdByUserId\`), INDEX \`IDX_cd93e672c80ffb5ce5975ca534\` (\`updatedByUserId\`), INDEX \`IDX_20a696a4ed9efc63b759988ab9\` (\`deletedByUserId\`), INDEX \`IDX_ec9c18c82b455f9a5c1c429980\` (\`isActive\`), INDEX \`IDX_49cb91250cb9427c775abd8572\` (\`isArchived\`), INDEX \`IDX_ec581c527298029aa27b72b7dd\` (\`tenantId\`), INDEX \`IDX_cad3841ce55a5903aa44d6d63d\` (\`organizationId\`), INDEX \`IDX_296c55d1f3203f65af3a8313a1\` (\`storageProvider\`), INDEX \`IDX_1ceaa21268b767159b202e3e51\` (\`recordedAt\`), INDEX \`IDX_b2b4988100343a2ee1e5dc10b2\` (\`timeSlotId\`), INDEX \`IDX_9055d166843ea7dc55234a9807\` (\`uploadedById\`), INDEX \`IDX_c8001dc9eda72fe5d23031cfba\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`camshots\` ADD CONSTRAINT \`FK_b534f6f40427fa2e210503b42f3\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`camshots\` ADD CONSTRAINT \`FK_cd93e672c80ffb5ce5975ca534a\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`camshots\` ADD CONSTRAINT \`FK_20a696a4ed9efc63b759988ab96\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`camshots\` ADD CONSTRAINT \`FK_ec581c527298029aa27b72b7ddc\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`camshots\` ADD CONSTRAINT \`FK_cad3841ce55a5903aa44d6d63d3\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`camshots\` ADD CONSTRAINT \`FK_b2b4988100343a2ee1e5dc10b22\` FOREIGN KEY (\`timeSlotId\`) REFERENCES \`time_slot\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`camshots\` ADD CONSTRAINT \`FK_9055d166843ea7dc55234a98073\` FOREIGN KEY (\`uploadedById\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`camshots\` ADD CONSTRAINT \`FK_c8001dc9eda72fe5d23031cfba5\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` DROP FOREIGN KEY \`FK_7ae5b4d4bdec77971dab319f2e2\``
		);
		await queryRunner.query(`ALTER TABLE \`camshots\` DROP FOREIGN KEY \`FK_c8001dc9eda72fe5d23031cfba5\``);
		await queryRunner.query(`ALTER TABLE \`camshots\` DROP FOREIGN KEY \`FK_9055d166843ea7dc55234a98073\``);
		await queryRunner.query(`ALTER TABLE \`camshots\` DROP FOREIGN KEY \`FK_b2b4988100343a2ee1e5dc10b22\``);
		await queryRunner.query(`ALTER TABLE \`camshots\` DROP FOREIGN KEY \`FK_cad3841ce55a5903aa44d6d63d3\``);
		await queryRunner.query(`ALTER TABLE \`camshots\` DROP FOREIGN KEY \`FK_ec581c527298029aa27b72b7ddc\``);
		await queryRunner.query(`ALTER TABLE \`camshots\` DROP FOREIGN KEY \`FK_20a696a4ed9efc63b759988ab96\``);
		await queryRunner.query(`ALTER TABLE \`camshots\` DROP FOREIGN KEY \`FK_cd93e672c80ffb5ce5975ca534a\``);
		await queryRunner.query(`ALTER TABLE \`camshots\` DROP FOREIGN KEY \`FK_b534f6f40427fa2e210503b42f3\``);
		await queryRunner.query(`DROP INDEX \`IDX_c8001dc9eda72fe5d23031cfba\` ON \`camshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_9055d166843ea7dc55234a9807\` ON \`camshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_b2b4988100343a2ee1e5dc10b2\` ON \`camshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_1ceaa21268b767159b202e3e51\` ON \`camshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_296c55d1f3203f65af3a8313a1\` ON \`camshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_cad3841ce55a5903aa44d6d63d\` ON \`camshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_ec581c527298029aa27b72b7dd\` ON \`camshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_49cb91250cb9427c775abd8572\` ON \`camshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_ec9c18c82b455f9a5c1c429980\` ON \`camshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_20a696a4ed9efc63b759988ab9\` ON \`camshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_cd93e672c80ffb5ce5975ca534\` ON \`camshots\``);
		await queryRunner.query(`DROP INDEX \`IDX_b534f6f40427fa2e210503b42f\` ON \`camshots\``);
		await queryRunner.query(`DROP TABLE \`camshots\``);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}
}
