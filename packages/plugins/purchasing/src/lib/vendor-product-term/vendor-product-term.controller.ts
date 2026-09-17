import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { PurchasingFeatures } from '../purchasing.features';
import { PurchasingPermissions } from '../purchasing.permissions';
import { BulkVendorProductTermDTO, CreateVendorProductTermDTO, UpdateVendorProductTermDTO } from './dto';
import { VendorProductTerm } from './vendor-product-term.entity';
import { VendorProductTermService } from './vendor-product-term.service';

/**
 * The negotiated terms with the organization's suppliers.
 *
 * One surface, and it is the agreement rather than the order: a term is the standing row a purchase
 * line is priced and dated from, so the routes here write and retire it and nothing else. The read
 * permission is its own value and is deliberately not implied by the purchase-order one — a buyer sees
 * the price that was applied on a line and the term it came from, which is provenance recorded on the
 * order, while the standing agreement is procurement's.
 *
 * Withdrawing a term is `DELETE`: a term a placed order used is never removed, its `status` moves to
 * `INACTIVE`, so the answer to "why was this ordered at 4.20?" survives the renegotiation.
 */
@ApiTags('VendorProductTerm')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(PurchasingFeatures.PURCHASING)
@Permissions(PurchasingPermissions.VENDOR_TERMS_VIEW)
@Controller('/vendor-product-terms')
export class VendorProductTermController extends CrudController<VendorProductTerm> {
	constructor(private readonly vendorProductTermService: VendorProductTermService) {
		super(vendorProductTermService);
	}

	/**
	 * Writes a term.
	 *
	 * @param entity The term to write.
	 * @returns The written term.
	 */
	@ApiOperation({ summary: 'Write a vendor term' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The term was written.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The supplier or the variant does not exist.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The quantity band overlaps a live term, or the window is not a window.' })
	@Permissions(PurchasingPermissions.VENDOR_TERMS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateVendorProductTermDTO): Promise<VendorProductTerm> {
		return await this.vendorProductTermService.create(entity as any);
	}

	/**
	 * Writes several terms in one call.
	 *
	 * This is how a product-wide agreement is recorded: a term with no variant is deliberately not
	 * supported, so the catalogue is written one row per variant and the operation that makes that
	 * bearable is this one.
	 *
	 * @param entity The terms to write.
	 * @returns The written terms.
	 */
	@ApiOperation({ summary: 'Write several vendor terms in one call' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The terms were written.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'A quantity band overlaps a live term.' })
	@Permissions(PurchasingPermissions.VENDOR_TERMS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post('bulk')
	@UseValidationPipe({ transform: true, whitelist: true })
	async bulkUpsert(@Body() entity: BulkVendorProductTermDTO): Promise<VendorProductTerm[]> {
		return await this.vendorProductTermService.bulkUpsert(entity.terms as any);
	}

	/**
	 * Amends a term.
	 *
	 * @param id The term to amend.
	 * @param entity The fields to change.
	 * @returns The amended term.
	 */
	@ApiOperation({ summary: 'Amend a vendor term' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The term was amended.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The amendment would overlap a live term, or is not a window.' })
	@Permissions(PurchasingPermissions.VENDOR_TERMS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateVendorProductTermDTO
	): Promise<VendorProductTerm> {
		return await this.vendorProductTermService.update(id, entity as any);
	}

	/**
	 * Retires a term.
	 *
	 * A term a placed order used is not removed: its status moves to `INACTIVE` and the row is answered
	 * back, which is what keeps the provenance on those orders readable.
	 *
	 * @param id The term to retire.
	 * @returns The retired term, or the deletion result when nothing had used it.
	 */
	@ApiOperation({ summary: 'Retire a vendor term' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The term was retired.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The term does not exist.' })
	@Permissions(PurchasingPermissions.VENDOR_TERMS_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return await this.vendorProductTermService.delete(id);
	}

	/**
	 * Reads one term.
	 *
	 * @param id The term to read.
	 * @returns The term.
	 */
	@ApiOperation({ summary: 'Find a vendor term' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The term was found.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The term does not exist.' })
	@Permissions(PurchasingPermissions.VENDOR_TERMS_VIEW)
	// The route the CRUD base maps for this method. An override replaces the inherited method *and*
	// its decorators, so the overriding controller restates it — without this line the detail endpoint
	// would simply not exist.
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<VendorProductTerm> {
		return await this.vendorProductTermService.findScoped(id);
	}

	/**
	 * Lists the standing terms.
	 *
	 * @param options The filter, including `filter[vendorId]`, `filter[variantId]`, `filter[status]`,
	 * `filter[currency]` and `filter[vendorProductCode]`.
	 * @returns The terms, paginated.
	 */
	@ApiOperation({ summary: 'List vendor terms' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The terms were listed.' })
	@Permissions(PurchasingPermissions.VENDOR_TERMS_VIEW)
	// The route the CRUD base maps for this method, restated for the same reason as `findById` above.
	@Get()
	async findAll(@Query() options: BaseQueryDTO<VendorProductTerm>): Promise<IPagination<VendorProductTerm>> {
		return await this.vendorProductTermService.findAll(options);
	}
}
