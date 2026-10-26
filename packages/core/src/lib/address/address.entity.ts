import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	MaxLength
} from 'class-validator';
import {
	AddressOwnerType,
	IAddressBook,
	ICountry,
	ID,
	IOrganizationContact,
	JsonData
} from '@gauzy/contracts';
import { Country, OrganizationContact, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { MikroOrmAddressRepository } from './repository/mikro-orm-address.repository';

/**
 * One row of the address book: a reusable postal address, owned by a party, a location or the
 * organization itself.
 *
 * **Why the table exists at all.** The platform carried exactly one address per contact — three
 * free-text fields on the shared contact row — and that shape cannot answer what the shipped documents
 * ask of it: which address a cart ships to, which one an invoice is issued to, which one a carrier
 * label prints as a return destination, which one a purchase order prints as its remit-to. The book is
 * the kernel's postal-address model, added **beside** `contact` and never overwriting it.
 *
 * **The owner is a dimension.** `ownerType` names what kind of thing the address belongs to and
 * `ownerId` names the row, with no foreign key: the target table depends on the type, which is the
 * platform's existing polymorphic shape and carries the same mitigation (a referential-integrity audit
 * rather than a constraint). `customerId` is the buyer-scoped reference that remains, and it must
 * equal `ownerId` when the owner is a contact — the service check `ADDRESS_OWNER_MISMATCH`.
 *
 * **`countryId` is a relation and `ownerId` is not**, and the difference is not an oversight: the
 * country lookup is one table, so it can be constrained and released to null when a country row is
 * removed, while the owner's target table is decided by a column value and cannot.
 *
 * **The two default booleans are a derived mirror.** The party's own `defaultShippingAddressId` /
 * `defaultBillingAddressId` columns are authoritative and these two are written in the same
 * transaction, so a write that disagrees fails with `ADDRESS_DEFAULT_MISMATCH` rather than leaving two
 * answers to one question. They are kept because a checkout that expands the party reads them and
 * because the two partial unique indexes are what make "at most one default per party" enforceable in
 * the database rather than only in a service. On MySQL, where a partial index whose predicate is a
 * boolean has no portable form, both are the service's rule inside the writing transaction plus the
 * nightly `address-default-reconcile`.
 *
 * **The role pivot hangs off this table and is not declared as a collection here.** `address_role`
 * carries `addressId` as its own column and its own `ON DELETE CASCADE` constraint, and the role set
 * is read and written through `AddressRoleService`. A `@OneToMany` declared on this side would need
 * the inverse property on the pivot — a restructuring of a domain that was delivered before this
 * table existed — and the platform's convention is to type across such a boundary by the identifier
 * rather than to import the other entity into a mutual import.
 */
@ColumnIndex('IDX_address_customer', ['customerId'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_address_org_customer', ['organizationId', 'customerId'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_address_org_country_zip', ['organizationId', 'countryCode', 'postalCode'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_address_org_owner', ['organizationId', 'ownerType', 'ownerId'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('UQ_address_default_shipping', ['customerId'], {
	unique: true,
	where: '"isDefaultShipping" = true AND "deletedAt" IS NULL'
})
// Both default indexes are declared for the two dialects that support a filtered index. MySQL has no
// such index, and neither rule can take the generated-column fallback: the predicate is a boolean, so
// appending a soft-delete key to `(customerId)` would forbid a party its second live address rather
// than its second default. On that dialect the two rules are `AddressService`'s, inside the writing
// transaction, and the nightly schema audit re-reports them — which is what the schema chapter
// prescribes for a uniqueness rule a dialect cannot express.
@ColumnIndex('UQ_address_default_billing', ['customerId'], {
	unique: true,
	where: '"isDefaultBilling" = true AND "deletedAt" IS NULL'
})
@MultiORMEntity('address', { mikroOrmRepository: () => MikroOrmAddressRepository })
export class Address extends TenantOrganizationBaseEntity implements IAddressBook {
	/**
	 * Customer-facing nickname ("Home", "Warehouse 2").
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	label?: string;

	/**
	 * The person to address at this location.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	contactName?: string;

	/**
	 * Company name as it should appear on a label or an invoice.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	company?: string;

	/**
	 * First name of the person at this location.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128, nullable: true })
	firstName?: string;

	/**
	 * Last name of the person at this location.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128, nullable: true })
	lastName?: string;

	/**
	 * Telephone number, as entered. Not normalised: an address in any country carries whatever form the
	 * sender writes, and a carrier label prints it verbatim.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	phone?: string;

	/**
	 * E-mail address, as entered — the delivery notification address, not an identity.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	email?: string;

	/**
	 * Street address. Required: an address that names no street names nothing, and a label cannot be
	 * printed from it.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	line1: string;

	/**
	 * Second line of the street address — a unit, a floor, a building.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	line2?: string;

	/**
	 * City or locality. Required for the same reason as the street line.
	 */
	@ApiProperty({ type: () => String, maxLength: 128 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128 })
	city: string;

	/**
	 * Free-text province name as entered.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128, nullable: true })
	province?: string;

	/**
	 * Normalised province/state code, and the member tax and shipping rules match on.
	 *
	 * Retained beside the free-text name rather than replacing it: the name is what the customer typed
	 * and what a label prints, while the code is the comparable form a rate table is keyed by.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 16 })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	provinceCode?: string;

	/**
	 * Postal or ZIP code, as entered.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	postalCode?: string;

	/**
	 * ISO 3166-1 alpha-2 country code, upper case. Always present.
	 *
	 * The service normalises it on every write, because it is what a tax rate, a shipping option and a
	 * carrier label all match on, and `us` and `US` are one country with two spellings only until
	 * something compares them.
	 */
	@ApiProperty({ type: () => String, maxLength: 2 })
	@IsNotEmpty()
	@IsString()
	@Length(2, 2)
	@MultiORMColumn({ type: 'varchar', length: 2 })
	countryCode: string;

	/**
	 * The country lookup row, when the code was recognised.
	 *
	 * Non-null exactly when `countryCode` matches a row of the country table. The reference releases
	 * rather than cascades when a country row is removed, because the address is the document and the
	 * lookup is a convenience.
	 */
	@ApiPropertyOptional({ type: () => Country })
	@IsOptional()
	@MultiORMManyToOne(() => Country, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	country?: ICountry;

	/**
	 * Id of the country lookup row. Resolved by the service from the stated country code, and cleared
	 * when the code matches nothing.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Address) => it.country)
	@MultiORMColumn({ nullable: true, relationId: true })
	countryId?: ID;

	/**
	 * Latitude, when the address was geocoded. Stored exactly, because a proximity query compares it.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		precision: 10,
		scale: 6,
		transformer: new ColumnNumericTransformerPipe()
	})
	latitude?: number;

	/**
	 * Longitude, when the address was geocoded.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		precision: 10,
		scale: 6,
		transformer: new ColumnNumericTransformerPipe()
	})
	longitude?: number;

	/**
	 * Whether this is the party's default shipping address.
	 *
	 * A derived mirror of the party's own column, never its authority — see the class note.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isDefaultShipping: boolean;

	/**
	 * The billing counterpart of the above, on the same terms.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isDefaultBilling: boolean;

	/**
	 * Whether an address-validation strategy has confirmed this address.
	 *
	 * Written by the validation operation and by nothing else: a create or a descriptive update that
	 * states it is refused, because an unvalidated address that reads as validated is worse than one
	 * that reads as unvalidated.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isValidated: boolean;

	/**
	 * Which validator produced the verdict, when one did.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	validationProviderKey?: string;

	/**
	 * What kind of thing the address belongs to. It decides which table `ownerId` names, which is why
	 * it is an enumeration rather than a free-text kind.
	 */
	@ApiProperty({ type: () => String, enum: AddressOwnerType, default: AddressOwnerType.CONTACT })
	@IsEnum(AddressOwnerType)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: AddressOwnerType,
		default: AddressOwnerType.CONTACT
	})
	ownerType: AddressOwnerType;

	/**
	 * The id of the row `ownerType` names. No foreign key: the target table depends on the type.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid' })
	ownerId: ID;

	/**
	 * The buyer this address is scoped to, when it is a party's.
	 *
	 * Null for an anonymous cart address created before the customer registers. When it is stated on a
	 * `CONTACT` address it must equal `ownerId`, and it is not stated at all on an address whose owner
	 * is not a party — both refusals are `ADDRESS_OWNER_MISMATCH`.
	 */
	@ApiPropertyOptional({ type: () => OrganizationContact })
	@IsOptional()
	@MultiORMManyToOne(() => OrganizationContact, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	customer?: IOrganizationContact;

	/**
	 * Id of the party. Cascades: an address that is a party's own row has no life without the party.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Address) => it.customer)
	@MultiORMColumn({ nullable: true, relationId: true })
	customerId?: ID;

	/**
	 * Tenant extras, including the raw provider response when the address was validated.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
