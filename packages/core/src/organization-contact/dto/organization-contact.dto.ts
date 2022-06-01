import {
	ContactOrganizationInviteStatus,
	ContactType,
	OrganizationContactBudgetTypeEnum
} from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class OrganizationContactDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => String, readOnly: true  })
    @IsNotEmpty()
    @IsString()
    readonly name: string;

    @ApiPropertyOptional({ type: () => String, readOnly: true  })
    @IsOptional()
    @IsEmail()
    @Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
    readonly primaryEmail: string;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly primaryPhone: string;

    @ApiPropertyOptional({ type: () => String, enum: ContactOrganizationInviteStatus, readOnly: true })
	@IsOptional()
	@IsEnum(ContactOrganizationInviteStatus)
	readonly inviteStatus: ContactOrganizationInviteStatus;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly notes: string;

    @ApiProperty({ type: () => String, enum: ContactType, readOnly: true })
	@IsEnum(ContactType)
	readonly contactType: ContactType;

    @ApiPropertyOptional({ type: () => String, maxLength: 500, readOnly: true })
	@IsOptional()
	@MaxLength(500)
	readonly imageUrl: string;

    @ApiPropertyOptional({ type: () => Number, readOnly: true })
	@IsOptional()
	@IsNumber()
	readonly budget: number;

    @ApiPropertyOptional({ type: () => String, enum: OrganizationContactBudgetTypeEnum, readOnly: true })
	@IsOptional()
	@IsEnum(OrganizationContactBudgetTypeEnum)
	readonly budgetType: OrganizationContactBudgetTypeEnum;

    @ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	readonly createdBy: string;
}