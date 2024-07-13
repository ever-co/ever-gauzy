import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateProductReviewTable1720852356593 implements MigrationInterface {
	name = 'CreateProductReviewTable1720852356593';

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
		await queryRunner.query(
			`CREATE TABLE "product_review" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "tenantId" uuid, "organizationId" uuid, "title" character varying, "description" text, "rating" integer NOT NULL, "upvotes" integer NOT NULL DEFAULT '0', "downvotes" integer NOT NULL DEFAULT '0', "status" character varying NOT NULL DEFAULT 'pending', "editedAt" TIMESTAMP, "productId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_6c00bd3bbee662e1f7a97dbce9a" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_6248458c7e237cef4adac4761d" ON "product_review" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9cb4931c7348b6c171f13b6216" ON "product_review" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_586e6b1273ba2732ec0ee41a80" ON "product_review" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_28ce717020729e36aa06cca5c5" ON "product_review" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_28f06c5655d507668b8839b59a" ON "product_review" ("upvotes") `);
		await queryRunner.query(`CREATE INDEX "IDX_f3591fd59cc32b585c3ba7d3ae" ON "product_review" ("downvotes") `);
		await queryRunner.query(`CREATE INDEX "IDX_913f7739f1262fc8c70cbbafa3" ON "product_review" ("editedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_06e7335708b5e7870f1eaa608d" ON "product_review" ("productId") `);
		await queryRunner.query(`CREATE INDEX "IDX_db21a1dc776b455ee83eb7ff88" ON "product_review" ("userId") `);
		await queryRunner.query(
			`ALTER TABLE "product_review" ADD CONSTRAINT "FK_586e6b1273ba2732ec0ee41a80b" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_review" ADD CONSTRAINT "FK_28ce717020729e36aa06cca5c54" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "product_review" ADD CONSTRAINT "FK_06e7335708b5e7870f1eaa608d2" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_review" ADD CONSTRAINT "FK_db21a1dc776b455ee83eb7ff88e" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "product_review" DROP CONSTRAINT "FK_db21a1dc776b455ee83eb7ff88e"`);
		await queryRunner.query(`ALTER TABLE "product_review" DROP CONSTRAINT "FK_06e7335708b5e7870f1eaa608d2"`);
		await queryRunner.query(`ALTER TABLE "product_review" DROP CONSTRAINT "FK_28ce717020729e36aa06cca5c54"`);
		await queryRunner.query(`ALTER TABLE "product_review" DROP CONSTRAINT "FK_586e6b1273ba2732ec0ee41a80b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_db21a1dc776b455ee83eb7ff88"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_06e7335708b5e7870f1eaa608d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_913f7739f1262fc8c70cbbafa3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f3591fd59cc32b585c3ba7d3ae"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_28f06c5655d507668b8839b59a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_28ce717020729e36aa06cca5c5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_586e6b1273ba2732ec0ee41a80"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9cb4931c7348b6c171f13b6216"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6248458c7e237cef4adac4761d"`);
		await queryRunner.query(`DROP TABLE "product_review"`);
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
