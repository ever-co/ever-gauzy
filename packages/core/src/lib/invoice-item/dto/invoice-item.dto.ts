import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsNotEmpty, IsBoolean } from 'class-validator';
import { TenantOrganizationBaseDTO } from '../../core/dto';

export abstract class InvoiceItemDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly description: string;

	@ApiProperty({ type: () => Number, readOnly: true })
	@IsNotEmpty()
	@IsNumber()
	readonly price: number;

	@ApiProperty({ type: () => Number, readOnly: true })
	@IsNotEmpty()
	@IsNumber()
	readonly quantity: number;

	@ApiProperty({ type: () => Number, readOnly: true })
	@IsNotEmpty()
	@IsNumber()
	readonly totalValue: number;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly invoiceId: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly taskId: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly employeeId: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly projectId: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly productId: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly expenseId: string;

	@ApiProperty({ type: () => Boolean, readOnly: true })
	@IsOptional()
	@IsBoolean()
	readonly applyTax: boolean;

	@ApiProperty({ type: () => Boolean, readOnly: true })
	@IsOptional()
	@IsBoolean()
	readonly applyDiscount: boolean;
}
