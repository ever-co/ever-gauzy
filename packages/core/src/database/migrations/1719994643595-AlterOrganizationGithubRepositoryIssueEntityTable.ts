import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterOrganizationGithubRepositoryIssueEntityTable1719994643595 implements MigrationInterface {
	name = 'AlterOrganizationGithubRepositoryIssueEntityTable1719994643595';

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
		await queryRunner.query(`DROP INDEX "public"."IDX_055f310a04a928343494a5255a"`);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" ALTER COLUMN "issueId" TYPE bigint`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" ALTER COLUMN "issueId" SET NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_055f310a04a928343494a5255a" ON "organization_github_repository_issue" ("issueId") `
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "public"."IDX_055f310a04a928343494a5255a"`);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" ALTER COLUMN "issueId" TYPE integer`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_github_repository_issue" ALTER COLUMN "issueId" SET NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_055f310a04a928343494a5255a" ON "organization_github_repository_issue" ("issueId") `
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
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`DROP INDEX \`IDX_055f310a04a928343494a5255a\` ON \`organization_github_repository_issue\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository_issue\` MODIFY COLUMN \`issueId\` bigint NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_055f310a04a928343494a5255a\` ON \`organization_github_repository_issue\` (\`issueId\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`DROP INDEX \`IDX_055f310a04a928343494a5255a\` ON \`organization_github_repository_issue\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_github_repository_issue\` MODIFY COLUMN \`issueId\` int NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_055f310a04a928343494a5255a\` ON \`organization_github_repository_issue\` (\`issueId\`)`
		);
	}
}
