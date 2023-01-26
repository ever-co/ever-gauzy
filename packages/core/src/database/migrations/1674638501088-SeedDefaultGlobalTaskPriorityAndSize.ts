import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import { DEFAULT_GLOBAL_PRIORITIES } from './../../tasks/priorities/default-global-priorities';
import { DEFAULT_GLOBAL_SIZES } from './../../tasks/sizes/default-global-sizes';

export class SeedDefaultGlobalTaskPriorityAndSize1674638501088
	implements MigrationInterface
{
	name = 'SeedDefaultGlobalTaskPriorityAndSize1674638501088';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<any> {
		await this.seedDefaultTaskPriorities(queryRunner);
		await this.seedDefaultTaskSizes(queryRunner);
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * Default global task priorities
	 *
	 * @param queryRunner
	 */
	async seedDefaultTaskPriorities(queryRunner: QueryRunner) {
		try {
			for await (const priority of DEFAULT_GLOBAL_PRIORITIES) {
				const payload = Object.values(priority);
				if (queryRunner.connection.options.type === 'sqlite') {
					payload.push(uuidV4());
					const query = `INSERT INTO "task_priority" ("name", "value", "description", "icon", "color", "isSystem", "id") VALUES($1, $2, $3, $4, $5, $6, $7)`;
					await queryRunner.connection.manager.query(query, payload);
				} else {
					const query = `INSERT INTO "task_priority" ("name", "value", "description", "icon", "color", "isSystem") VALUES($1, $2, $3, $4, $5, $6)`;
					await queryRunner.connection.manager.query(query, payload);
				}
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log(
				'Error while insert default global task priorities in production server',
				error
			);
		}
	}

	/**
	 * Default global task sizes
	 *
	 * @param queryRunner
	 */
	async seedDefaultTaskSizes(queryRunner: QueryRunner) {
		try {
			for await (const size of DEFAULT_GLOBAL_SIZES) {
				const payload = Object.values(size);
				if (queryRunner.connection.options.type === 'sqlite') {
					payload.push(uuidV4());
					const query = `INSERT INTO "task_size" ("name", "value", "description", "icon", "color", "isSystem", "id") VALUES($1, $2, $3, $4, $5, $6, $7)`;
					await queryRunner.connection.manager.query(query, payload);
				} else {
					const query = `INSERT INTO "task_size" ("name", "value", "description", "icon", "color", "isSystem") VALUES($1, $2, $3, $4, $5, $6)`;
					await queryRunner.connection.manager.query(query, payload);
				}
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log(
				'Error while insert default global task sizes in production server',
				error
			);
		}
	}
}
