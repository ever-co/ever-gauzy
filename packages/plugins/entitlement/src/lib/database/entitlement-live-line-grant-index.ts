import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmEntitlementRepository } from '../entitlement/repository/type-orm-entitlement.repository';
import { AddEntitlementLiveLineGrantUniqueIndex1791000003580 } from './migrations/1791000003580-AddEntitlementLiveLineGrantUniqueIndex';

/**
 * Whether `UQ_entitlement_live_line_grant` (#11023) holds the rule in this database, and the check that installs it
 * once it can.
 *
 * The migration withholds the index where order lines already carry more than one live right, and is recorded as
 * run all the same, so cleaning those rights up later would never bring it back. This check runs the migration's own
 * guarded statements again at every start (#11601 review): it creates the index once nothing violates it, logs the
 * affected order lines while something still does, and answers what it found. The grant reads the answer: without
 * the index it holds the order line for its transaction instead (`lockOrderLine`), so the race stays closed either
 * way.
 *
 * The statements run on TypeORM's connection whichever ORM the installation runs, as the migrations do. Anything that
 * goes wrong is logged and leaves the answer at "absent", which is the safe one: it costs a grant a lock, never a
 * second licence.
 */
@Injectable()
export class EntitlementLiveLineGrantIndex implements OnApplicationBootstrap {
	private readonly logger = new Logger(EntitlementLiveLineGrantIndex.name);

	/** What the last check found; absent until a check has seen the index. */
	private present = false;

	constructor(private readonly typeOrmEntitlementRepository: TypeOrmEntitlementRepository) {}

	async onApplicationBootstrap(): Promise<void> {
		await this.refresh();
	}

	/** Whether the last check found the index in place. */
	isPresent(): boolean {
		return this.present;
	}

	/**
	 * Creates the index when it is missing and nothing violates it, and records whether it is there.
	 *
	 * @returns Whether the index is there.
	 */
	async refresh(): Promise<boolean> {
		const queryRunner = this.typeOrmEntitlementRepository.manager.connection.createQueryRunner();

		try {
			this.present = await new AddEntitlementLiveLineGrantUniqueIndex1791000003580().install(queryRunner);
		} catch (error) {
			this.present = false;
			this.logger.error(
				`UQ_entitlement_live_line_grant could not be checked or created (${(error as Error)?.message}); ` +
					`a grant of an order line locks the line for its transaction until a later start finds the index.`
			);
		} finally {
			await queryRunner.release();
		}

		return this.present;
	}
}
