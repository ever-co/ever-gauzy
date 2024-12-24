import { ApiProperty, ApiPropertyOptional, IntersectionType, PickType } from "@nestjs/swagger";
import {
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	MaxLength
} from "class-validator";
import {
	ContactOrganizationInviteStatus,
	ContactType,
	OrganizationContactBudgetTypeEnum
} from "@gauzy/contracts";
import { OrganizationContact } from "./../organization-contact.entity";
import { TenantOrganizationBaseDTO } from "../../core/dto";
import { Trimmed } from "../../shared/decorators/trim.decorator";

export class OrganizationContactDTO extends IntersectionType(
	PickType(OrganizationContact, ['imageId']),
	TenantOrganizationBaseDTO
) {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsEmail()
	@Trimmed()
	readonly primaryEmail: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly primaryPhone: string;

	@ApiPropertyOptional({ type: () => String, enum: ContactOrganizationInviteStatus })
	@IsOptional()
	@IsEnum(ContactOrganizationInviteStatus)
	readonly inviteStatus: ContactOrganizationInviteStatus;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly notes: string;

	@ApiProperty({ type: () => String, enum: ContactType })
	@IsEnum(ContactType)
	readonly contactType: ContactType;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@IsOptional()
	@MaxLength(500)
	readonly imageUrl: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly budget: number;

	@ApiPropertyOptional({ type: () => String, enum: OrganizationContactBudgetTypeEnum })
	@IsOptional()
	@IsEnum(OrganizationContactBudgetTypeEnum)
	readonly budgetType: OrganizationContactBudgetTypeEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly createdBy: string;
}
