import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import {
	ColumnIndex,
	Integration,
	JsonArrayColumn,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ID } from '@gauzy/contracts';
import { MikroOrmPaymentProviderRepository } from './repository/mikro-orm-payment-provider.repository';
import { IPaymentProvider } from '../payment.types';

/**
 * A provider registration: the row that says this organization takes money through that provider.
 *
 * **Credentials are never here.** The integration this row points at holds them in its
 * `integration_setting` rows, where they are wrapped, excluded from serialization and rotated in one
 * place; `configuration` carries what an operator may read — a capture mode, a statement descriptor,
 * a webhook path — and a write that puts a secret in it is refused by the service rather than stored.
 *
 * Availability is not a column either: a minimum amount, a currency, a country or a customer-group
 * restriction is a `rule` row with owner type `PAYMENT_PROVIDER`, evaluated by the same rule engine
 * that decides everything else, so a provider that a channel must not offer is excluded for a reason
 * that can be read back.
 */
@MultiORMEntity('payment_provider', { mikroOrmRepository: () => MikroOrmPaymentProviderRepository })
export class PaymentProvider extends TenantOrganizationBaseEntity implements IPaymentProvider {
	/**
	 * The provider's stable key. It matches the registered provider strategy the adapter is resolved
	 * from, so it is the one value a caller may not invent.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/**
	 * Operator-facing label shown wherever a provider is chosen.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	name: string;

	/**
	 * A disabled provider is never offered at checkout. It is a registration that is kept — with its
	 * history — and withdrawn from the payment step.
	 */
	@ApiProperty({ type: () => Boolean, default: true })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	isEnabled: boolean;

	/**
	 * When true, sessions are created against the provider's sandbox and the movements they produce
	 * are test movements.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTestMode: boolean;

	/**
	 * The integration registry row whose settings hold the credentials. Optional: an offline method
	 * needs no integration, and detaching one must not delete the registration that produced the
	 * sessions already on record.
	 */
	@MultiORMManyToOne(() => Integration, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	integration?: Integration;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PaymentProvider) => it.integration)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	integrationId?: ID;

	/**
	 * ISO-4217 codes this provider may be used with; null means every currency the provider supports.
	 *
	 * Held as a JSON array rather than the `simple-array` form, because a `simple-array` column is
	 * understood by one ORM only and this build runs both.
	 */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@JsonArrayColumn<string>({ nullable: true })
	supportedCurrencies?: string[];

	/**
	 * ISO-3166-1 alpha-2 codes this provider may be used from; null means every country.
	 */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@JsonArrayColumn<string>({ nullable: true })
	supportedCountries?: string[];

	/**
	 * The payment methods this provider accepts, drawn from the platform's payment-method vocabulary.
	 */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@JsonArrayColumn<string>({ nullable: true })
	supportedPaymentMethods?: string[];

	/**
	 * Display order in the payment step. Lower is offered first.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	sortOrder: number;

	/**
	 * Non-secret configuration the adapter reads: capture mode, statement descriptor, webhook path,
	 * event map. A key that names a credential is refused on write, because a secret here would be a
	 * second, unmanaged copy of one.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	configuration?: Record<string, unknown>;

	/**
	 * Provider capabilities the operator recorded: whether partial capture and partial refund are
	 * supported, whether a return URL is required. Open-ended, so a JSON document rather than a
	 * column per key.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;
}
