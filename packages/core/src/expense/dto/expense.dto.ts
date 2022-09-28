import {
    ExpenseStatusesEnum,
    IExpenseCategory,
    IOrganizationContact,
    IOrganizationProject
} from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class ExpenseDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => Number, readOnly: true  })
    @IsNotEmpty()
    readonly amount: number;

    @ApiPropertyOptional({ type: () => Date, readOnly: true  })
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

    @ApiPropertyOptional({ type: () => String, readOnly: true  })
    @IsOptional()
    @IsString()
    readonly typeOfExpense: string;

    @ApiPropertyOptional({ type: () => String, readOnly: true  })
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

    @ApiPropertyOptional({ type: () => Number, readOnly: true  })
    @IsOptional()
    readonly rateValue: number;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly receipt: string;

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true  })
    @IsOptional()
    @IsBoolean()
    readonly splitExpense: boolean;

    @ApiProperty({ type: () => String, enum: ExpenseStatusesEnum, readOnly: true })
    @IsOptional()
    @IsEnum(ExpenseStatusesEnum)
    readonly status: ExpenseStatusesEnum;

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

    @ApiProperty({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly category: IExpenseCategory;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly categoryId: IExpenseCategory['id'];
}