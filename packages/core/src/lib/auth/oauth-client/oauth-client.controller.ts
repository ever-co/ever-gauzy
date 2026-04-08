/**
 * `OAuthClientController` — admin CRUD for the multi-app OAuth client
 * registry.
 *
 * What changed from the single-app version:
 * Previously there was no admin surface — the one OAuth client was an
 * env var. This controller is the new admin entry point a tenant
 * SUPER_ADMIN / ADMIN uses to register Activepieces, n8n, etc., rotate
 * secrets, and revoke clients.
 *
 * Mounting / guards:
 * - Mounted at `/oauth/clients` (under the global API prefix).
 * - Guarded with `TenantPermissionGuard` + `PermissionGuard`, the same
 *   pair every other tenant-scoped admin controller uses.
 * - Read endpoints require `OAUTH_CLIENT_VIEW`.
 * - Mutating endpoints require `OAUTH_CLIENT_EDIT`.
 * - Both permissions are scoped to SUPER_ADMIN and ADMIN via the
 *   `ADMINISTRATION` permission group in `role-permission.model.ts`.
 *
 * Note: This is the ADMIN registry surface. The third-party-facing
 * authorization endpoints (`/integration/ever-gauzy/oauth/authorize`
 * and `/token`) are unchanged and still live in
 * `packages/auth/src/lib/oauth-app/oauth-app.controller.ts` — they will
 * be rewired to use this service in Section 3.
 */
import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../../shared/pipes';
import { OAuthClientService } from './oauth-client.service';
import {
	CreateOAuthClientDTO,
	OAuthClientResponseDTO,
	OAuthClientWithSecretResponseDTO,
	UpdateOAuthClientDTO
} from './dto';

@ApiTags('OAuthClient')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/oauth/clients')
export class OAuthClientController {
	constructor(private readonly oauthClientService: OAuthClientService) {}

	/**
	 * Register a new OAuth client. Returns the plaintext client secret
	 * EXACTLY ONCE — there is no way to retrieve it later.
	 */
	@ApiOperation({ summary: 'Register a new OAuth client (third-party app)' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description:
			'Client created. The response includes the plaintext clientSecret exactly once — store it immediately.'
	})
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input' })
	@Permissions(PermissionsEnum.OAUTH_CLIENT_EDIT)
	@Post('/')
	@HttpCode(HttpStatus.CREATED)
	@Header('Cache-Control', 'no-store')
	@Header('Pragma', 'no-cache')
	@UseValidationPipe({ whitelist: true, transform: true })
	async create(@Body() dto: CreateOAuthClientDTO): Promise<OAuthClientWithSecretResponseDTO> {
		return this.oauthClientService.createClient(dto);
	}

	/**
	 * Paginated list of OAuth clients visible to the caller.
	 */
	@ApiOperation({ summary: 'List OAuth clients for the current tenant' })
	@ApiResponse({ status: HttpStatus.OK })
	@Permissions(PermissionsEnum.OAUTH_CLIENT_VIEW)
	@Get('/')
	async findAll(
		@Query('skip') skip?: string,
		@Query('take') take?: string
	): Promise<IPagination<OAuthClientResponseDTO>> {
		// Lightweight pagination — we deliberately avoid `BaseQueryDTO`
		// here because that DTO chain (via `FindWhereQueryDTO`) marks
		// `where` as `@IsNotEmpty()`, which would 400 every list call
		// from the admin UI for no benefit. The registry is small and
		// always scoped via `listForCurrentTenant`.

		// Validate pagination params to prevent NaN propagation
		const parsedSkip = skip !== undefined ? Number.parseInt(skip, 10) : undefined;
		const parsedTake = take !== undefined ? Number.parseInt(take, 10) : undefined;

		if (parsedSkip !== undefined && (!Number.isFinite(parsedSkip) || parsedSkip < 0)) {
			throw new BadRequestException('Invalid skip parameter: must be a non-negative integer');
		}
		if (parsedTake !== undefined && (!Number.isFinite(parsedTake) || parsedTake < 1)) {
			throw new BadRequestException('Invalid take parameter: must be a positive integer');
		}

		return this.oauthClientService.listForCurrentTenant({
			skip: parsedSkip,
			take: parsedTake
		});
	}

	/**
	 * Read a single OAuth client by internal id (UUID).
	 */
	@ApiOperation({ summary: 'Get an OAuth client by id' })
	@ApiResponse({ status: HttpStatus.OK })
	@ApiResponse({ status: HttpStatus.NOT_FOUND })
	@Permissions(PermissionsEnum.OAUTH_CLIENT_VIEW)
	@Get('/:id')
	async findOne(@Param('id', UUIDValidationPipe) id: ID): Promise<OAuthClientResponseDTO> {
		return this.oauthClientService.findOneSafe(id);
	}

	/**
	 * Update mutable fields. Cannot change `clientId` / `clientSecretHash`
	 * / `codeSecret` directly — those have dedicated paths.
	 */
	@ApiOperation({ summary: 'Update an OAuth client' })
	@ApiResponse({ status: HttpStatus.OK })
	@Permissions(PermissionsEnum.OAUTH_CLIENT_EDIT)
	@Patch('/:id')
	@UseValidationPipe({ whitelist: true, transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() dto: UpdateOAuthClientDTO
	): Promise<OAuthClientResponseDTO> {
		return this.oauthClientService.updateClient(id, dto);
	}

	/**
	 * Generate a new client secret. Returns the plaintext value exactly
	 * once. Existing access tokens previously issued under the old secret
	 * stay valid until they expire — only NEW `/token` exchanges are
	 * affected.
	 */
	@ApiOperation({ summary: 'Rotate the client secret (returns plaintext once)' })
	@ApiResponse({ status: HttpStatus.OK })
	@Permissions(PermissionsEnum.OAUTH_CLIENT_EDIT)
	@Post('/:id/rotate-secret')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Header('Pragma', 'no-cache')
	async rotateSecret(
		@Param('id', UUIDValidationPipe) id: ID
	): Promise<OAuthClientWithSecretResponseDTO> {
		return this.oauthClientService.rotateSecret(id);
	}

	/**
	 * Soft-delete (revoke) an OAuth client. After this, `findByClientId`
	 * refuses to resolve it and the third-party app can no longer obtain
	 * new authorization codes or access tokens.
	 */
	@ApiOperation({ summary: 'Revoke (soft-delete) an OAuth client' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@Permissions(PermissionsEnum.OAUTH_CLIENT_EDIT)
	@Delete('/:id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async remove(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		await this.oauthClientService.softDeleteClient(id);
	}
}
