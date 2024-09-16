import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterFavoriteEntityIndexing1726506479984 implements MigrationInterface {
	name = 'AlterFavoriteEntityIndexing1726506479984';

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
		await queryRunner.query(`DROP INDEX "public"."IDX_a8d924902879f0a3349678c86f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b4734abeedbb9c724c980f7f54"`);
		await queryRunner.query(`CREATE INDEX "IDX_837468421e96f22a2e12022ef0" ON "favorite" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_e88acab853ab012582c6d0f3f6" ON "favorite" ("entityId") `);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "public"."IDX_e88acab853ab012582c6d0f3f6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_837468421e96f22a2e12022ef0"`);
		await queryRunner.query(`CREATE INDEX "IDX_b4734abeedbb9c724c980f7f54" ON "favorite" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a8d924902879f0a3349678c86f" ON "favorite" ("entity") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_b4734abeedbb9c724c980f7f54"`);
		await queryRunner.query(`DROP INDEX "IDX_a8d924902879f0a3349678c86f"`);
		await queryRunner.query(`CREATE INDEX "IDX_837468421e96f22a2e12022ef0" ON "favorite" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_e88acab853ab012582c6d0f3f6" ON "favorite" ("entityId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_e88acab853ab012582c6d0f3f6"`);
		await queryRunner.query(`DROP INDEX "IDX_837468421e96f22a2e12022ef0"`);
		await queryRunner.query(`CREATE INDEX "IDX_a8d924902879f0a3349678c86f" ON "favorite" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_b4734abeedbb9c724c980f7f54" ON "favorite" ("entityId") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX \`IDX_a8d924902879f0a3349678c86f\` ON \`favorite\``);
		await queryRunner.query(`DROP INDEX \`IDX_b4734abeedbb9c724c980f7f54\` ON \`favorite\``);
		await queryRunner.query(`CREATE INDEX \`IDX_837468421e96f22a2e12022ef0\` ON \`favorite\` (\`entity\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_e88acab853ab012582c6d0f3f6\` ON \`favorite\` (\`entityId\`)`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX \`IDX_e88acab853ab012582c6d0f3f6\` ON \`favorite\``);
		await queryRunner.query(`DROP INDEX \`IDX_837468421e96f22a2e12022ef0\` ON \`favorite\``);
		await queryRunner.query(`CREATE INDEX \`IDX_b4734abeedbb9c724c980f7f54\` ON \`favorite\` (\`entityId\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_a8d924902879f0a3349678c86f\` ON \`favorite\` (\`entity\`)`);
	}
}
