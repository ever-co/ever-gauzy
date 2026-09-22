import { BadRequestException, Body, Controller, Get, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import {
	DocumentInboundAddressKindEnum,
	FeatureEnum,
	ID,
	IDocumentInboundAddressSecret,
	IDocumentInboundDomainVerification,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	RequestContext,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { InboundAddressService } from '../capture/inbound-address.service';
import { DocumentInboundAddress } from '../entities/document-inbound-address.entity';
import {
	CreateDocumentInboundAddressDTO,
	DocumentInboundAddressQueryDTO,
	UpdateDocumentInboundAddressDTO
} from '../dto/document-inbound-address.dto';

/**
 * Tenant-facing management of inbound email capture addresses.
 *
 * Guarded exactly like every other Documents settings surface — tenant, permission and feature
 * flag — which is what distinguishes it from the `@Public()` webhook that *receives* the mail.
 *
 * Mutating routes require `DOCS_MANAGE` rather than `DOCS_UPDATE`: adding a capture address opens
 * an ingestion channel into the organization, which is an administrative act, not document editing.
 */
@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs/inbound-addresses')
export class DocumentInboundAddressController {
	constructor(private readonly inboundAddressService: InboundAddressService) {}

	/**
	 * Lists the organization's capture addresses, minting the platform one on first call.
	 *
	 * `webhookSecretHash` is stripped from every response — a hash is still a verifier, and this
	 * endpoint is readable by anyone with `DOCS_READ`.
	 */
	@ApiOperation({ summary: "List the organization's inbound capture addresses." })
	@ApiResponse({ status: HttpStatus.OK, description: 'Addresses retrieved successfully.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/')
	public async list(@Query() query: DocumentInboundAddressQueryDTO): Promise<Partial<DocumentInboundAddress>[]> {
		const { tenantId, organizationId } = this.scope(query?.organizationId);
		const rows = await this.inboundAddressService.listForOrganization(tenantId, organizationId);
		return rows.map((row) => this.toResponse(row));
	}

	/**
	 * Registers a capture address on a domain the organization owns.
	 *
	 * The response carries the relay secret in plaintext — the only time it is ever returned.
	 */
	@ApiOperation({ summary: 'Register an inbound capture address on a tenant-owned domain.' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Address created; verification pending.' })
	@Permissions(PermissionsEnum.DOCS_MANAGE)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Post('/')
	public async create(
		@Body() input: CreateDocumentInboundAddressDTO
	): Promise<{ address: Partial<DocumentInboundAddress>; secret: IDocumentInboundAddressSecret; verification: IDocumentInboundDomainVerification }> {
		if (input.kind !== DocumentInboundAddressKindEnum.CUSTOM_DOMAIN) {
			// The platform address is minted automatically; offering a second way to create one
			// would let a caller mint duplicates for the same organization.
			throw new BadRequestException(
				'A platform address is provisioned automatically — only a custom domain can be created here.'
			);
		}
		const { tenantId, organizationId } = this.scope(input?.organizationId);
		const { row, secret } = await this.inboundAddressService.createCustomDomain(
			tenantId,
			organizationId,
			input
		);
		return {
			address: this.toResponse(row),
			secret,
			verification: this.inboundAddressService.describeVerification(row)
		};
	}

	/**
	 * The DNS record to publish, and where verification currently stands.
	 */
	@ApiOperation({ summary: 'Show the DNS record required to verify a custom inbound domain.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Verification details retrieved.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/:id/verification')
	public async verification(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query: DocumentInboundAddressQueryDTO
	): Promise<IDocumentInboundDomainVerification> {
		const { tenantId, organizationId } = this.scope(query?.organizationId);
		const rows = await this.inboundAddressService.listForOrganization(tenantId, organizationId);
		const row = rows.find((candidate) => candidate.id === id);
		if (!row) {
			throw new BadRequestException('Inbound address not found.');
		}
		return this.inboundAddressService.describeVerification(row);
	}

	/**
	 * Performs the DNS lookup and arms the address if the record is present.
	 */
	@ApiOperation({ summary: 'Check the DNS TXT record and verify the domain.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Verification attempted.' })
	@Permissions(PermissionsEnum.DOCS_MANAGE)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Post('/:id/verify')
	public async verify(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: DocumentInboundAddressQueryDTO
	): Promise<IDocumentInboundDomainVerification> {
		const { tenantId, organizationId } = this.scope(body?.organizationId);
		return this.inboundAddressService.verifyDomain(tenantId, organizationId, id);
	}

	/**
	 * Issues a new relay secret, invalidating the previous one. Returned in plaintext once.
	 */
	@ApiOperation({ summary: 'Rotate the relay secret for an inbound address.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Secret rotated.' })
	@Permissions(PermissionsEnum.DOCS_MANAGE)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Post('/:id/rotate-secret')
	public async rotateSecret(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: DocumentInboundAddressQueryDTO
	): Promise<IDocumentInboundAddressSecret> {
		const { tenantId, organizationId } = this.scope(body?.organizationId);
		return this.inboundAddressService.rotateSecret(tenantId, organizationId, id);
	}

	/**
	 * Mints a new token for a platform address — i.e. a new address. Use when the current one
	 * has leaked and started collecting junk.
	 */
	@ApiOperation({ summary: 'Rotate a platform capture address to a new token.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Address rotated.' })
	@Permissions(PermissionsEnum.DOCS_MANAGE)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Post('/:id/rotate-address')
	public async rotateAddress(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: DocumentInboundAddressQueryDTO
	): Promise<Partial<DocumentInboundAddress>> {
		const { tenantId, organizationId } = this.scope(body?.organizationId);
		const row = await this.inboundAddressService.rotateAddress(tenantId, organizationId, id);
		return this.toResponse(row);
	}

	/**
	 * Updates the sender allowlist, body-import preference, or active flag.
	 */
	@ApiOperation({ summary: 'Update an inbound capture address.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Address updated.' })
	@Permissions(PermissionsEnum.DOCS_MANAGE)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Put('/:id')
	public async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: UpdateDocumentInboundAddressDTO
	): Promise<Partial<DocumentInboundAddress>> {
		const { tenantId, organizationId } = this.scope(input?.organizationId);
		const row = await this.inboundAddressService.update(tenantId, organizationId, id, input);
		return this.toResponse(row);
	}

	/**
	 * Resolves the effective scope, preferring an explicit organization over the request context.
	 */
	private scope(organizationId?: ID): { tenantId: ID; organizationId: ID } {
		const tenantId = RequestContext.currentTenantId() as ID;
		const resolved = (organizationId ?? RequestContext.currentOrganizationId()) as ID;
		if (!tenantId || !resolved) {
			throw new BadRequestException('An organization scope is required.');
		}
		return { tenantId, organizationId: resolved };
	}

	/**
	 * Response projection. Drops `webhookSecretHash` — never expose a verifier, even hashed.
	 */
	private toResponse(row: DocumentInboundAddress): Partial<DocumentInboundAddress> {
		const { webhookSecretHash, senderAllowlistRaw, ...rest } = row;
		return {
			...rest,
			// Surface the allowlist as a list rather than the raw JSON text column.
			senderAllowlist: row.senderAllowlist
		} as Partial<DocumentInboundAddress>;
	}
}
