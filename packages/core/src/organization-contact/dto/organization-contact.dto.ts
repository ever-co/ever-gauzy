import {
	ContactOrganizationInviteStatus,
	ContactType,
	OrganizationContactBudgetTypeEnum
} from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional, IntersectionType, PickType } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import {
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	MaxLength
} from "class-validator";
import { OrganizationContact } from "./../organization-contact.entity";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

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
	@Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
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
