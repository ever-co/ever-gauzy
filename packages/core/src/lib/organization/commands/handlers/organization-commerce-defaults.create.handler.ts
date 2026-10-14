import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createDefaultCommerceDefaults } from '../../../core/seeds/commerce-defaults.seed';
import { OrganizationCommerceDefaultsCreateCommand } from '../organization-commerce-defaults.create.command';

/**
 * Writes the per-organization commerce defaults for an organization created at runtime.
 *
 * The same function the fresh-install seed calls, writing the same rows `1791000000520-SeedCoreDefaults`
 * writes for the organizations that existed when it ran — see `createDefaultCommerceDefaults` for why
 * there are three paths and how they are kept in agreement. Without it, an organization created after
 * the upgrade had no numbering series, so its first order failed with 404 "No numbering series is
 * configured for ORDER" and its first purchase order with 409 `PURCHASE_ORDER_SEQUENCE_MISSING`.
 *
 * The statements are raw SQL on the TypeORM connection, guarded by schema, so they run the same under
 * either ORM and skip what an installation without the tax or the pricing plugin does not have.
 */
@CommandHandler(OrganizationCommerceDefaultsCreateCommand)
export class OrganizationCommerceDefaultsCreateHandler
	implements ICommandHandler<OrganizationCommerceDefaultsCreateCommand>
{
	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	/**
	 * @param command The organization to seed for.
	 */
	public async execute(command: OrganizationCommerceDefaultsCreateCommand): Promise<void> {
		await createDefaultCommerceDefaults(this.dataSource, [command.organization]);
	}
}
