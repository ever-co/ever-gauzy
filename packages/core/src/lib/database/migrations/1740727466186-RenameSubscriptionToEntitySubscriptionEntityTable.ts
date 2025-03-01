import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';

export class RenameSubscriptionToEntitySubscriptionEntityTable1740727466186 implements MigrationInterface {
	name = 'RenameSubscriptionToEntitySubscriptionEntityTable1740727466186';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		await queryRunner.renameTable('subscription', 'entity_subscription');
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.renameTable('entity_subscription', 'subscription');
	}
}
