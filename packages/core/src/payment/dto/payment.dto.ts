import { CurrenciesEnum, IEmployee, IInvoice, IOrganizationContact, IOrganizationProject, ITag, IUser, PaymentMethodEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export abstract class PaymentDTO {

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsNotEmpty()
    readonly amount: number;

    @ApiProperty({ type: () => String, enum: CurrenciesEnum, readOnly: true  })
    @IsEnum(CurrenciesEnum)
    @IsNotEmpty()
    readonly currency: CurrenciesEnum;

    @ApiProperty({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly overdue: boolean;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly note: string;

    @ApiProperty({ type: () => String, enum: PaymentMethodEnum })
    @IsEnum(PaymentMethodEnum)
    @IsString()
    readonly paymentMethod: PaymentMethodEnum;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly employeeId: string;

    @ApiProperty({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly employee: IEmployee;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly invoice: IInvoice;

    @ApiProperty({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly recordedBy: IUser;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly recordedById: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly invoiceId: string;

    @ApiProperty({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly project: IOrganizationProject;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly projectId: string;

    @ApiProperty({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly organizationContact: IOrganizationContact;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly organizationContactId: string;

    @ApiProperty({ type: () => Object,isArray: true, readOnly: true })
    @IsOptional()
    readonly tags: ITag[];

}