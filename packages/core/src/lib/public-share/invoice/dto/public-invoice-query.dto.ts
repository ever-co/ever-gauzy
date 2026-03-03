import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

/**
 * Allowed relations for the public invoice endpoint.
 *
 * Only relations whose columns are explicitly constrained by the service's
 * `select` clause are permitted.  Any relation not in this enum will be
 * rejected by class-validator.
 */
export enum PublicInvoiceRelationEnum {
	'tenant' = 'tenant',
	'organization' = 'organization',
	'fromOrganization' = 'fromOrganization',
	'toContact' = 'toContact',
	'invoiceItems' = 'invoiceItems',
	'invoiceItems.employee' = 'invoiceItems.employee',
	'invoiceItems.employee.user' = 'invoiceItems.employee.user',
	'invoiceItems.project' = 'invoiceItems.project',
	'invoiceItems.product' = 'invoiceItems.product',
	'invoiceItems.expense' = 'invoiceItems.expense',
	'invoiceItems.task' = 'invoiceItems.task'
}

/**
 * Get public invoice request DTO validation
 */
export class PublicInvoiceQueryDTO {
	@ApiPropertyOptional({ type: () => String, enum: PublicInvoiceRelationEnum })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => (value ? value.map((element: string) => element.trim()) : []))
	@IsEnum(PublicInvoiceRelationEnum, { each: true })
	readonly relations: string[] = [];
}