import { TenantOrganizationBaseDTO } from "core/dto";
import { CurrenciesEnum, IOrganizationContact, IOrganizationProject, ITag } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDate, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from "class-validator";

export abstract class ExpenseDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => Number })
    @IsNumber()
    @IsNotEmpty()
    readonly amount: number;

    @ApiProperty({ type: () => String, enum: CurrenciesEnum })
    @IsEnum(CurrenciesEnum)
    @IsNotEmpty()
    readonly currency: string;

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    readonly valueDate: Date;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly notes: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly reference: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly typeOfExpense: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly purpose: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly taxType: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly taxLabel: string;

    @ApiPropertyOptional({ type: () => Number })
    @IsOptional()
    readonly rateValue: number;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly receipt: string;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly splitExpense: boolean;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly status: string;

    @ApiPropertyOptional({ type: () => Object, isArray: true })
    @IsOptional()
    readonly tags: ITag[];

    @ApiProperty({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly project: IOrganizationProject;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly projectId?: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly organizationContactId: string;

    @ApiProperty({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly organizationContact: IOrganizationContact;

}