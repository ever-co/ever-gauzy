import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The configuration of one provider integration. Settings and secret references only: no credential and no card data is ever stored here.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class PaymentProviderDTO extends TenantOrganizationBaseDTO {
	/**
	 * Provider key. Must match the registered provider strategy key.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@MaxLength(64)
	readonly code: string;

	/**
	 * Operator-facing label.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MaxLength(255)
	readonly name: string;

	/**
	 * A disabled provider is never offered at checkout.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isEnabled: boolean = true;

	/**
	 * When true, sessions are created against the provider sandbox.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isTestMode: boolean = false;

	/**
	 * The integration registry row whose settings hold the credentials.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly integrationId?: string;

	/**
	 * ISO-4217 codes the provider may be used with; null means all.
	 */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	readonly supportedCurrencies?: string[];

	/**
	 * ISO-3166-1 alpha-2 codes the provider may be used from; null means all.
	 */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	readonly supportedCountries?: string[];

	/**
	 * Payment method values the provider accepts.
	 */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	readonly supportedPaymentMethods?: string[];

	/**
	 * Display order in the payment step.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly sortOrder: number = 0;

	/**
	 * Non-secret configuration only: capture mode, statement descriptor, signature scheme, webhook path.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly configuration?: Record<string, unknown>;

	/**
	 * Tolerance window, partial capture and partial refund support, return URL requirement.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
