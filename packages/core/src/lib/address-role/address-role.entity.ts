import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { AddressRoleEnum } from './address-role.enums';
import { MikroOrmAddressRoleRepository } from './repository/mikro-orm-address-role.repository';

/**
 * What one address is *for*, one row per role it plays.
 *
 * **Why a pivot and not a column.** One address is routinely both the billing and the shipping address.
 * The two booleans the address book already carries express that correctly in one row, and a
 * single-valued `type` column would regress it — so the roles are rows and the booleans stay, as the
 * derived mirror of the two roles that have one.
 *
 * **Why `addressId` is a plain column and not a relation.** The address book is a core table owned by
 * the module that declares it, and that module is not this one: declaring a relation here would import
 * an entity class that does not exist yet and make this module unbuildable until it does. The column is
 * declared as the plain identifier it is, and the foreign key — `ON DELETE CASCADE`, because a role row
 * has no meaning without its address — is created by the migration when the address table is present.
 * The same reasoning the tax ledger uses for `taxRateId`, which points at a table its own package does
 * not declare.
 *
 * **Why "at most one default per owner and role" is not an index.** The owner lives on `address`, not
 * here, so the tuple spans two tables and no portable unique constraint expresses it. It is a service
 * check plus the nightly `address-default-reconcile`, exactly as the schema chapter states — and
 * `AddressRoleService.defaultFor` is the check, so a caller cannot read two answers and believe both.
 */
@MultiORMEntity('address_role', { mikroOrmRepository: () => MikroOrmAddressRoleRepository })
export class AddressRole extends TenantOrganizationBaseEntity {
	/**
	 * The address this role belongs to.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	addressId: ID;

	/**
	 * What the address is for.
	 */
	@ApiProperty({ type: () => String, enum: AddressRoleEnum })
	@IsEnum(AddressRoleEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16 })
	role: AddressRoleEnum;

	/**
	 * The default address for this role and this owner.
	 *
	 * For `SHIPPING` and `BILLING` this mirrors the address book's own boolean, and the two are written
	 * in one transaction: a write that disagrees fails with `ADDRESS_DEFAULT_MISMATCH` rather than
	 * leaving two answers to the same question.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isDefault: boolean;

	/**
	 * Tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
