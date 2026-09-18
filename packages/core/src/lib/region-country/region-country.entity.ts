import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ICountry, ID, IRegion, IRegionCountry } from '@gauzy/contracts';
import { Country, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { Region } from '../region/region.entity';
import { MikroOrmRegionCountryRepository } from './repository/mikro-orm-region-country.repository';

/**
 * One country inside one commercial geography.
 *
 * **Two questions, one read.** A shipping address has to be answered twice before a cart can be priced:
 * is it inside the region at all, and is the sale into that country exempt from tax there? Both answers
 * are this row, which is why the membership is a table rather than a list of identifiers on the region
 * — `isTaxExempt` and the optional province scope are facts of the membership itself.
 *
 * **Both sides are peers, so both references cascade.** The membership has no meaning without its region
 * or without its country. The country reference is created inline by the migration that creates this
 * table and only where the country master is present, because the master is a kernel table delivered
 * long before this set and a fresh installation may legitimately be synchronised from the entities
 * rather than replayed from migrations.
 *
 * **One row per pair among live rows.** A soft-deleted membership must not keep the pair occupied for
 * ever, and two rows for one pair would be two answers to the same question. On MySQL the rule is
 * expressed with the documented generated `deletedKey` column, because that dialect has no filtered
 * index.
 *
 * **`provinceCodes` is absent or a non-empty list, never an empty one.** Absent means the whole country
 * is in the region; an empty list would name a scope that contains nothing while every consumer that
 * tests for absence reads it as "the whole country" — the one value the two readings of the column
 * disagree about. The service refuses it.
 */
@ColumnIndex('UQ_region_country', ['regionId', 'countryId'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_region_country_country', ['countryId'])
@MultiORMEntity('region_country', { mikroOrmRepository: () => MikroOrmRegionCountryRepository })
export class RegionCountry extends TenantOrganizationBaseEntity implements IRegionCountry {
	/**
	 * The region the country belongs to.
	 */
	@ApiProperty({ type: () => Region })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Region, (it) => it.countries, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	region: IRegion;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: RegionCountry) => it.region)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	regionId: ID;

	/**
	 * The country that is in the region.
	 */
	@ApiProperty({ type: () => Country })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Country, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	country: ICountry;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: RegionCountry) => it.country)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	countryId: ID;

	/**
	 * Whether sales into this country carry no tax in this region.
	 *
	 * An export sale: the goods leave the region's tax jurisdiction, so the region states the exemption
	 * per country rather than the tax engine inferring it from a rate of zero, which would be a rate
	 * that has to exist and be maintained for every exempt destination.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxExempt: boolean;

	/**
	 * Optional sub-national scope: when set, only these province or state codes are in the region.
	 *
	 * Absent means the whole country. A list of province codes is what lets one country be split across
	 * two regions — a country whose sub-national jurisdictions tax differently is the ordinary case,
	 * not an exotic one.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: 'simple-array', nullable: true })
	provinceCodes?: string[];
}
