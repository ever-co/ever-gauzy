import { CurrenciesEnum, DiscountTaxTypeEnum, IInvoiceEstimateHistory, IOrganization, IOrganizationContact, IPayment, ITag } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { CreateInvoiceEstimateHistoryDTO } from "invoice-estimate-history/dto";
import { CreateInvoiceItemDTO } from "invoice-item/dto";

export abstract class InvoiceDTO {

    @ApiProperty({ type: () => Date, readOnly: true })
    @IsNotEmpty()
    readonly invoiceDate: Date;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsNotEmpty()
    @IsNumber()
    readonly invoiceNumber: number;

    @ApiProperty({ type: () => Date, readOnly: true })
    @IsNotEmpty()
    readonly dueDate: Date;

    @ApiProperty({ type: () => String, enum: CurrenciesEnum, readOnly: true })
    @IsNotEmpty()
    @IsEnum(CurrenciesEnum)
    readonly currency: CurrenciesEnum;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly discountValue: number;

    @ApiProperty({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly paid: boolean;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly tax: number;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly tax2: number;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly terms: string;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly status: string;

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

    @ApiPropertyOptional({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly fromOrganization: IOrganization;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly fromOrganizationId: string;

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