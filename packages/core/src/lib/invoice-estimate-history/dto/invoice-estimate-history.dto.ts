import { IInvoice, IUser } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { TenantOrganizationBaseDTO } from '../../core/dto';

export abstract class InvoiceEstimateHistoryDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly action: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly title: string;

	@ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
	@IsObject()
	readonly user: IUser;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly userId: string;

	@ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
	@IsObject()
	readonly invoice: IInvoice;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly invoiceId: string;
}
