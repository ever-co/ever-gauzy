import {
	Body,
	Controller,
	Delete,
	HttpCode,
	HttpException,
	HttpStatus,
	Logger,
	Post,
	Put,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ValidationError } from 'class-validator';
import { IGenerateApiKeyResponse, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UseValidationPipe } from '../shared/pipes';
import { GenerateApiKeyDTO } from './dto/generate-api-key.dto';
import { RenameApiKeyDTO } from './dto/rename-api-key.dto';
import { ITenantApiKeyView, TenantApiKeyService } from './tenant-api-key.service';

@ApiTags('TenantAPIKeys')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/tenant-api-key')
export class TenantApiKeyController {
	private readonly logger = new Logger(TenantApiKeyController.name);

	constructor(private readonly tenantApiKeyService: TenantApiKeyService) {}

	/**
	 * Generates a new API key pair (key and secret) for a tenant.
	 *
	 * @param {GenerateApiKeyDTO} input - The DTO containing tenant details for API key generation.
	 * @returns {Promise<ITenantApiKey>} The newly generated API key pair.
	 */
	@Post('/generate-key-pair')
	@Permissions(PermissionsEnum.TENANT_API_KEY_CREATE)
	@ApiOperation({ summary: 'Generate a new API key pair for a tenant.' })
	@ApiResponse({ status: 201, description: 'API key pair generated successfully.' })
	@ApiResponse({ status: 400, description: 'Invalid input data.' })
	@UseValidationPipe()
	async generateKeyPair(@Body() input: GenerateApiKeyDTO): Promise<IGenerateApiKeyResponse> {
		try {
			return await this.tenantApiKeyService.generateApiKey(input);
		} catch (error) {
			if (error instanceof ValidationError) {
				throw new HttpException('Invalid API key parameters', HttpStatus.BAD_REQUEST);
			}
			throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Renames the caller's tenant's API key. The name is the only member that changes after issuance; the
	 * answer carries neither the key nor the secret.
	 *
	 * Stated under `TENANT_API_KEY_CREATE`, the grant that names a pair when it is issued.
	 */
	@Put('/')
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.TENANT_API_KEY_CREATE)
	@ApiOperation({ summary: "Rename the caller's tenant's API key." })
	@ApiResponse({ status: 202, description: 'The key, without its key or secret.' })
	@ApiResponse({ status: 404, description: 'The tenant holds no live key.' })
	@UseValidationPipe({ whitelist: true })
	async rename(@Body() input: RenameApiKeyDTO): Promise<ITenantApiKeyView> {
		return await this.tenantApiKeyService.renameApiKey(input.name);
	}

	/**
	 * Revokes the caller's tenant's API key: it stops authenticating at once and a new pair can be generated.
	 * Answers whether a key was revoked — `false` when the tenant held none.
	 *
	 * Stated under `TENANT_API_KEY_DELETE`.
	 */
	@Delete('/')
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.TENANT_API_KEY_DELETE)
	@ApiOperation({ summary: "Revoke the caller's tenant's API key." })
	@ApiResponse({ status: 200, description: 'Whether a key was revoked.' })
	async revoke(): Promise<boolean> {
		return await this.tenantApiKeyService.revokeApiKey();
	}
}
