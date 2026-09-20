import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { WarehouseFeatures } from '../warehouse.features';
import { WarehousePermissions } from '../warehouse.permissions';
import { CarrierManifestService, CarrierManifestWithMembers } from './carrier-manifest.service';
import { CarrierManifest } from './carrier-manifest.entity';
import {
	CancelCarrierManifestDTO,
	CarrierManifestDTO,
	CreateCarrierManifestDTO,
	HandOverCarrierManifestDTO,
	UpdateCarrierManifestDTO
} from './dto';

/**
 * The documents handed to a carrier.
 *
 * Membership is never posted: a draft resolves it from what actually shipped inside the window and has
 * not been claimed, and closing freezes it. A caller that could name the members could put one parcel
 * on two manifests, which is the invariant the whole table exists to keep.
 */
@ApiTags('CarrierManifest')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
@Permissions(WarehousePermissions.FULFILLMENTS_VIEW)
@Controller('/carrier-manifests')
export class CarrierManifestController extends CrudController<CarrierManifest> {
	constructor(private readonly carrierManifestService: CarrierManifestService) {
		super(carrierManifestService);
	}

	/**
	 * Lists carrier manifests.
	 *
	 * @param options The filter, including `filter[carrier]` and `filter[status]`.
	 * @returns The manifests, paginated.
	 */
	@ApiOperation({ summary: 'List carrier manifests' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The manifests were listed.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<CarrierManifest>): Promise<IPagination<CarrierManifest>> {
		return await this.carrierManifestService.findAll(options);
	}

	/**
	 * Reads a manifest with the shipments it covers.
	 *
	 * @param id The manifest.
	 * @returns The manifest and its members.
	 */
	@ApiOperation({ summary: 'Read a manifest with its shipments' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The manifest was found.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<CarrierManifestWithMembers> {
		return await this.carrierManifestService.findOneDetailed(id);
	}

	/**
	 * Builds a draft manifest for a carrier, a day and a window.
	 *
	 * @param entity The manifest to create.
	 * @returns The created manifest.
	 */
	@ApiOperation({ summary: 'Build a draft manifest for a carrier' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The manifest was created.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCarrierManifestDTO): Promise<CarrierManifest> {
		return await this.carrierManifestService.create(entity as any);
	}

	/**
	 * Updates a draft manifest's day, window and note.
	 *
	 * @param id The manifest.
	 * @param entity The fields to change.
	 * @returns The updated manifest.
	 */
	@ApiOperation({ summary: 'Update a draft manifest' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The manifest was updated.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateCarrierManifestDTO & CarrierManifestDTO
	): Promise<CarrierManifest> {
		await this.carrierManifestService.update(id, entity as any);

		return await this.carrierManifestService.findOneScoped(id);
	}

	/**
	 * Submits the draft: membership is frozen on every member shipment.
	 *
	 * @param id The manifest.
	 * @returns The closed manifest, with the members it now covers.
	 */
	@ApiOperation({ summary: 'Submit a draft manifest, freezing its membership' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The manifest was closed.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The manifest is empty or a member is untracked.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Post(':id/submit')
	async submit(@Param('id', UUIDValidationPipe) id: ID): Promise<CarrierManifestWithMembers> {
		return await this.carrierManifestService.close(id);
	}

	/**
	 * Records the carrier taking custody at the dock.
	 *
	 * @param id The manifest.
	 * @param entity What the dock recorded, including any scan that does not match the manifest.
	 * @returns The handed-over manifest.
	 */
	@ApiOperation({ summary: 'Hand the parcels over to the carrier' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The manifest was handed over.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Idempotent({ scope: 'warehouse.handover', required: false, resourceType: 'carrier-manifest' })
	@Post(':id/handover')
	@UseValidationPipe({ transform: true, whitelist: true })
	async handOver(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: HandOverCarrierManifestDTO
	): Promise<CarrierManifestWithMembers> {
		return await this.carrierManifestService.handOver(id, {
			scanCount: entity.scanCount,
			scannedTrackingNumbers: entity.scannedTrackingNumbers,
			note: entity.note
		});
	}

	/**
	 * Cancels a manifest the carrier has not taken, returning its members to the pool.
	 *
	 * @param id The manifest.
	 * @param entity Why it was withdrawn.
	 * @returns The cancelled manifest.
	 */
	@ApiOperation({ summary: 'Cancel a manifest before hand-over' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The manifest was cancelled.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'A handed-over manifest is never cancelled.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Post(':id/cancel')
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: CancelCarrierManifestDTO
	): Promise<CarrierManifestWithMembers> {
		return await this.carrierManifestService.cancel(id, entity.reason);
	}
}
