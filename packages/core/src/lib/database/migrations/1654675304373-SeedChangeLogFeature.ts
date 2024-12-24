import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { v4 as uuidV4 } from 'uuid';
import { DatabaseTypeEnum } from '@gauzy/config';

export class SeedChangeLogFeature1654675304373 implements MigrationInterface {
	name = 'SeedChangeLogFeature1654675304373';

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

	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const date = Date.now();
		const features = [
			{
				icon: 'cube-outline',
				title: 'New CRM',
				date,
				isFeature: 1,
				content: 'Now you can read latest features changelog directly in Gauzy',
				learnMoreUrl: '',
				imageUrl: 'assets/images/features/macbook-2.png'
			},
			{
				icon: 'globe-outline',
				title: 'Most popular in 20 countries',
				date,
				isFeature: 1,
				content: 'Europe, Americas and Asia get choice',
				learnMoreUrl: '',
				imageUrl: 'assets/images/features/macbook-1.png'
			},
			{
				icon: 'flash-outline',
				title: 'Visit our website',
				date,
				isFeature: 1,
				content: 'You are welcome to check more information about the platform at our official website.',
				learnMoreUrl: '',
				imageUrl: ''
			}
		];
		try {
			for await (const feature of features) {
				const payload = Object.values(feature);
				payload.push(uuidV4());
				await queryRunner.connection.manager.query(
					`
					INSERT INTO "changelog" ("icon", "title", "date", "isFeature", "content", "learnMoreUrl", "imageUrl", "id") VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
					payload
				);
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log('Error while insert changelog changes in production server', error);
		}
	}

	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const date = new Date();
		const features = [
			{
				icon: 'cube-outline',
				title: 'New CRM',
				date,
				isFeature: true,
				content: 'Now you can read latest features changelog directly in Gauzy',
				learnMoreUrl: '',
				imageUrl: 'assets/images/features/macbook-2.png'
			},
			{
				icon: 'globe-outline',
				title: 'Most popular in 20 countries',
				date,
				isFeature: true,
				content: 'Europe, Americas and Asia get choice',
				learnMoreUrl: '',
				imageUrl: 'assets/images/features/macbook-1.png'
			},
			{
				icon: 'flash-outline',
				title: 'Visit our website',
				date,
				isFeature: true,
				content: 'You are welcome to check more information about the platform at our official website.',
				learnMoreUrl: '',
				imageUrl: ''
			}
		];
		try {
			for await (const feature of features) {
				const payload = Object.values(feature);
				await queryRunner.connection.manager.query(
					`
					INSERT INTO "changelog" ("icon", "title", "date", "isFeature", "content", "learnMoreUrl", "imageUrl") VALUES($1, $2, $3, $4, $5, $6, $7)`,
					payload
				);
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log('Error while insert changelog changes in production server', error);
		}
	}

	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}

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
