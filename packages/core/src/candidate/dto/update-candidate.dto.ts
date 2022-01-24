import { ICandidateUpdateInput, IContact, IOrganizationDepartment, IOrganizationEmploymentType, IOrganizationPosition, ITag } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";

export class UpdateCandidateDTO implements ICandidateUpdateInput { 

    @ApiProperty({ type: () => String })
    @IsString()
    @IsOptional()
    readonly payPeriod?: string;

    @ApiProperty({ type: () => Number })
    @IsString()
    @IsOptional()
    readonly billRateValue?: number;

    @ApiProperty({ type: () => String })
    @IsString()
    @IsOptional()
    readonly billRateCurrency?: string;

    @ApiProperty({ type: () => Number })
    @IsOptional()
    readonly reWeeklyLimit?: number;

    @ApiProperty({ type: () => Array })
    @IsOptional()
    readonly organizationDepartments?: IOrganizationDepartment[];

    @ApiProperty({ type: () => Object })
    @IsOptional()
    readonly organizationPosition?: IOrganizationPosition;

    @ApiProperty({ type: () => Array })
    @IsOptional()
    readonly organizationEmploymentTypes?: IOrganizationEmploymentType[];

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsObject()
    readonly tags?: ITag[];

    @ApiProperty({ type: () => Object })
    @IsOptional()
    readonly contact?: IContact;

    @ApiProperty({ type: () => Date })
    @IsOptional()
    readonly appliedDate?: Date;

    @ApiProperty({ type: () => Date })
    @IsOptional()
    readonly hiredDate?: Date;

    @ApiProperty({ type: () => Date })
    @IsOptional()
    readonly rejectDate?: Date;

    @ApiProperty({ type: () => String })
    @IsString()
    @IsOptional()
    readonly cvUrl?: string;

    @ApiProperty({ type: () => String })
    @IsString()
    @IsOptional()
    readonly candidateLevel?: string;

}