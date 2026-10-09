import { ID, IInvoice, IUser } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { TenantOrganizationBaseDTO } from '../../core/dto';

export abstract class InvoiceEstimateHistoryDTO extends TenantOrganizationBaseDTO {
	/**
	 * An existing history record sent back with its invoice. Declared so a whitelisted invoice update
	 * keeps it linked instead of inserting a copy; ownership is checked by TenantAwareCrudService's
	 * nested-graph check.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly id?: ID;

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
