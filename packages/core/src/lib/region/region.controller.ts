import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IRegion, IRegionCountry, ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { paginateRows, resolveRestPage } from '../api/graphql-connection';
import { CrudController } from '../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Region } from './region.entity';
import { RegionService } from './region.service';
import { RegionCountryService } from '../region-country/region-country.service';
import {
	CreateRegionDTO,
	DeleteRegionQueryDTO,
	RegionDetailQueryDTO,
	RegionQueryDTO,
	ReplaceRegionCountriesDTO,
	UpdateRegionDTO
} from './dto';

/**
 * The commercial geography over REST.
 *
 * **A region is the place a cart is priced in.** Currency, tax-inclusivity and the payment and
 * shipping providers that are enabled are decided per region, so this resource is where a
 * geography's commercial facts are administered — and its country set, which is what makes "is this
 * address inside the region, and is the sale into it exempt" answerable in one read.
 *
 * **Every route speaks through `RegionService` or `RegionCountryService`**, which own the two rules a
 * geography cannot be written without: a region prices in a currency the platform knows (invariant
 * I-26), and at most one region per organization is the default — with the flag *moved* rather than
 * merely constrained, because a partial unique index can express "at most one" and cannot move it.
 *
 * **The country set is a set operation, not a member-per-call pair.** `PUT /regions/:id/countries`
 * replaces the served set in one transaction: writing it member by member would make "remove a
 * country" and "add a country" two calls that can each fail on their own.
 *
 * **Removal is retirement.** A cart, a tax rate and a price list may all name a region, so `DELETE`
 * archives it and answers with the retired row; a hard delete is what a retention job does, and the
 * service offers none. The `force` member the endpoint table names is accepted and validated, and it
 * cannot make a hard delete exist — that is reported rather than papered over.
 *
 * **Every inherited CRUD route this class overrides restates its own route decorator**, and `create`
 * and `update` are declared here because a body is validated from the type the handler names.
 */
@ApiTags('Region')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.REGIONS_VIEW)
@Controller('/regions')
export class RegionController extends CrudController<Region> {
	constructor(
		private readonly regionService: RegionService,
		private readonly regionCountryService: RegionCountryService
	) {
		super(regionService);
	}

	/**
	 * Lists the regions of the caller's organization, newest first.
	 *
	 * @param query The narrowing and the page to read.
	 * @returns One page of regions, with the countries the caller asked to expand.
	 */
	@ApiOperation({ summary: 'List regions' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Regions retrieved' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'QUERY_EXPAND_NOT_ALLOWED, QUERY_PAGE_LIMIT_EXCEEDED' })
	@Permissions(PermissionsEnum.REGIONS_VIEW)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: RegionQueryDTO): Promise<IPagination<IRegion>> {
		const rows = await this.regionService.listRegions(this.narrowing(query));
		const { take, skip } = resolveRestPage(query?.take, query?.skip);
		const page = paginateRows(rows, take, skip);

		return this.withCountries(page.items, query?.expand, page.total);
	}

	/**
	 * Reads one region, optionally with the countries it serves attached.
	 *
	 * @param id The region to read.
	 * @param query Which relations to attach.
	 * @returns The region.
	 */
	@ApiOperation({ summary: 'Find a region by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Region retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.REGIONS_VIEW)
	@Get(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() query?: RegionDetailQueryDTO): Promise<IRegion> {
		const region = await this.regionService.findRegionOrFail(id);
		const expanded = await this.withCountries([region], query?.expand);

		return expanded.items[0];
	}

	/**
	 * Opens a commercial geography.
	 *
	 * @param entity The region as the caller states it.
	 * @returns The stored region.
	 */
	@ApiOperation({ summary: 'Create a region' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Region created' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'VALIDATION_REQUIRED_FIELD, VALIDATION_FAILED, REGION_CURRENCY_UNKNOWN, UNIQUE_CONSTRAINT_VIOLATION'
	})
	@Permissions(PermissionsEnum.REGIONS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateRegionDTO): Promise<IRegion> {
		return this.regionService.createRegion(entity);
	}

	/**
	 * Changes the descriptive facts of a region.
	 *
	 * @param id The region to change.
	 * @param entity The facts to change.
	 * @returns The stored region.
	 */
	@ApiOperation({ summary: 'Update a region' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Region updated' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'VALIDATION_FAILED, REGION_CURRENCY_UNKNOWN' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.REGIONS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateRegionDTO): Promise<IRegion> {
		return this.regionService.updateRegion(id, entity);
	}

	/**
	 * Replaces the served-country set.
	 *
	 * @param id The region whose set is replaced.
	 * @param entity The countries the region serves afterwards.
	 * @returns The stored membership rows.
	 */
	@ApiOperation({ summary: 'Replace the served-country set of a region' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Country set replaced' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'VALIDATION_REQUIRED_FIELD, VALIDATION_FAILED, REGION_COUNTRY_EXISTS'
	})
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.REGIONS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Put(':id/countries')
	@UseValidationPipe({ transform: true, whitelist: true })
	async replaceCountries(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReplaceRegionCountriesDTO
	): Promise<IRegionCountry[]> {
		return this.regionCountryService.replaceCountries(
			id,
			(entity?.countries ?? []).map((member) => ({
				countryId: member.countryId,
				isTaxExempt: member.isTaxExempt,
				provinceCodes: member.provinceCodes
			}))
		);
	}

	/**
	 * Claims the organization's default region, releasing the flag from the previous holder.
	 *
	 * @param id The region to make the default.
	 * @returns The stored region.
	 */
	@ApiOperation({ summary: 'Mark a region as the organization default' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Default region changed' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.REGIONS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Post(':id/set-default')
	async setDefault(@Param('id', UUIDValidationPipe) id: ID): Promise<IRegion> {
		return this.regionService.setDefaultRegion(id);
	}

	/**
	 * Retires a region.
	 *
	 * The region keeps its rows — a cart, a tax rate and a price list may all name it — and stops
	 * being offered by its channels, which is what retirement means.
	 *
	 * @param id The region to retire.
	 * @param query The `force` member the endpoint table names.
	 * @returns The stored region, `ARCHIVED`.
	 */
	@ApiOperation({ summary: 'Retire a region' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Region archived' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.REGIONS_DELETE)
	@HttpCode(HttpStatus.OK)
	@Delete(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async delete(@Param('id', UUIDValidationPipe) id: ID, @Query() _query?: DeleteRegionQueryDTO): Promise<IRegion> {
		return this.regionService.archiveRegion(id);
	}

	/**
	 * Attaches the country set to the regions the caller asked to expand.
	 *
	 * @param rows The regions.
	 * @param expand The relations to attach.
	 * @param total The filtered total, which the expansion does not change.
	 * @returns The page, with `countries` attached.
	 */
	private async withCountries(
		rows: readonly IRegion[],
		expand?: readonly string[],
		total?: number
	): Promise<IPagination<IRegion>> {
		if (!(expand ?? []).includes('countries')) {
			return { items: [...rows], total: total ?? rows.length };
		}

		const items = await Promise.all(
			rows.map(async (region) => ({
				...region,
				countries: await this.regionCountryService.listCountries(region.id)
			}))
		);

		return { items, total: total ?? rows.length };
	}

	/**
	 * The equality members of the list query, from whichever spelling stated them.
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: RegionQueryDTO): {
		status?: IRegion['status'];
		code?: string;
		currency?: IRegion['currency'];
		isDefault?: boolean;
	} {
		const stated: { status?: IRegion['status']; code?: string; currency?: IRegion['currency']; isDefault?: boolean } =
			{};

		for (const member of ['status', 'code', 'currency', 'isDefault'] as const) {
			const value = query?.[member] ?? query?.filter?.[member];

			if (value !== undefined && value !== null) {
				stated[member] = value as never;
			}
		}

		return stated;
	}
}
