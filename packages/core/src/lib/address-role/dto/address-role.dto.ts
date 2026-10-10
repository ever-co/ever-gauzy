import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { AddressRoleEnum } from '../address-role.enums';

/**
 * A role given to one address.
 *
 * `addressId` is validated as a UUID rather than against a relation, because the address table is
 * declared by the module that owns the address book: this DTO states what the role row needs, and the
 * service that writes it is reached from the address book with an address it has already read.
 */
export class CreateAddressRoleDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly addressId: ID;

	@ApiProperty({ type: () => String, enum: AddressRoleEnum })
	@IsEnum(AddressRoleEnum)
	readonly role: AddressRoleEnum;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isDefault?: boolean;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * A change to a role row.
 */
export class UpdateAddressRoleDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isDefault?: boolean;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * The candidate set a default is resolved over.
 *
 * The owner of an address lives on the address row, so the caller that knows it names the addresses of
 * that owner and the service answers over exactly those — which is what makes "at most one default per
 * owner and role" checkable at all.
 */
export class SetAddressRoleDefaultDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => [String] })
	@IsArray()
	@ArrayMinSize(0)
	@IsUUID(undefined, { each: true })
	readonly ownerAddressIds: ID[];
}
