import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { ICountry } from './country.model';
import { IRegion } from './region.model';

/**
 * One country inside one commercial geography.
 *
 * The row answers two questions in one indexed read: whether a shipping address is inside the region,
 * and whether sales into that country are exempt there. It is a pivot between two peers with two facts
 * of its own, which is why it is a table rather than a list on the region: `isTaxExempt` is per country
 * and `provinceCodes` narrows the membership below the country, and neither could be expressed by a
 * list of identifiers. `provinceCodes` is either absent — the whole country is in the region — or a
 * non-empty list of the province codes that are, and never an empty list, which would name a scope
 * that contains nothing and read as "the whole country" to every consumer that tests for absence.
 */
export interface IRegionCountry extends IBasePerTenantAndOrganizationEntityModel {
	/** The region the country belongs to. */
	regionId: ID;
	/** The region row `regionId` names. */
	region?: IRegion;
	/** The country that is in the region. */
	countryId: ID;
	/** The country row `countryId` names. */
	country?: ICountry;
	/** Whether sales into this country carry no tax in this region — an export sale. */
	isTaxExempt: boolean;
	/** Optional sub-national scope. Absent means the whole country; otherwise a non-empty list of province codes. */
	provinceCodes?: string[];
}

/**
 * One member of a region's country set, as the whole-set replacement states it.
 *
 * The administration surface saves a region's countries as a set, so the input carries the country and
 * its two facts and nothing else. `regionId` is not a member: the replacement is stated against one
 * region and every row it writes belongs to it.
 */
export interface IRegionCountryInput {
	/** The country to place in the region. */
	countryId: ID;
	/** Whether sales into the country are tax exempt in this region. Defaults to false. */
	isTaxExempt?: boolean;
	/** Sub-national scope: absent for the whole country, otherwise a non-empty list of province codes. */
	provinceCodes?: string[];
}
