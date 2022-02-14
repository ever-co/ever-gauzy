import { CurrenciesEnum, DiscountTaxTypeEnum, IInvoiceEstimateHistory, InvoiceStatusTypesEnum, IOrganizationContact, IPayment, ITag } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { CreateInvoiceEstimateHistoryDTO } from "invoice-estimate-history/dto";
import { CreateInvoiceItemDTO } from "invoice-item/dto";

export abstract class InvoiceDTO {

    @ApiProperty({ type: () => Date, readOnly: true })
    @IsNotEmpty()
    readonly invoiceDate: Date;

    @ApiProperty({ type: () => Date, readOnly: true })
    @IsNotEmpty()
    readonly dueDate: Date;

    @ApiProperty({ type: () => String, enum: InvoiceStatusTypesEnum, readOnly: true })
    @IsNotEmpty()
    @IsEnum(InvoiceStatusTypesEnum)
    readonly status: InvoiceStatusTypesEnum;

    @ApiPropertyOptional({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly totalValue: number;

    @ApiProperty({ type: () => String, enum: CurrenciesEnum, readOnly: true })
    @IsNotEmpty()
    @IsEnum(CurrenciesEnum)
    readonly currency: CurrenciesEnum;

    @ApiProperty({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly paid: boolean;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly terms: string;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly organizationContactId: string;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly organizationContactName: string;

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isEstimate: boolean;

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isAccepted: boolean;

    @ApiProperty({ type: () => String, enum: DiscountTaxTypeEnum, readOnly: true })
    @IsOptional()
    @IsEnum(DiscountTaxTypeEnum)
    readonly discountType: DiscountTaxTypeEnum;

    @ApiProperty({ type: () => String, enum: DiscountTaxTypeEnum , readOnly: true})
    @IsOptional()
    @IsEnum(DiscountTaxTypeEnum)
    readonly taxType: DiscountTaxTypeEnum;

    @ApiProperty({ type: () => String, enum: DiscountTaxTypeEnum, readOnly: true })
    @IsOptional()
    @IsEnum(DiscountTaxTypeEnum)
    readonly tax2Type: DiscountTaxTypeEnum;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly internalNote: string;

    @ApiPropertyOptional({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly alreadyPaid: number;

    @ApiPropertyOptional({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly amountDue: number;

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly hasRemainingAmountInvoiced: boolean;

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isArchived: boolean;

    @ApiPropertyOptional({ type: () => Object })
    @IsOptional()
    @IsObject()
    readonly toContact: IOrganizationContact;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly toContactId: string;

    @ApiPropertyOptional({ type: () => Object, isArray: true, readOnly: true })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateInvoiceItemDTO)
    readonly invoiceItems: CreateInvoiceItemDTO[];

    @ApiPropertyOptional({ type: () => Object, isArray: true, readOnly: true })
    @IsOptional()
    readonly payments: IPayment[];

    @ApiPropertyOptional({ type: () => Array, isArray: true, readOnly: true })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateInvoiceEstimateHistoryDTO)
    readonly historyRecords: IInvoiceEstimateHistory[];

    @ApiProperty({ type: () => Object, isArray: true, readOnly: true })
    @IsOptional()
    readonly tags: ITag[];

}