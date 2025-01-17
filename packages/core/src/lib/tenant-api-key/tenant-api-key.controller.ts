import { Controller, Post, Body, HttpException, HttpStatus, UseGuards, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ValidationError } from 'class-validator';
import { IGenerateApiKeyResponse, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UseValidationPipe } from '../shared/pipes';
import { GenerateApiKeyDTO } from './dto/generate-api-key.dto';
import { TenantApiKeyService } from './tenant-api-key.service';

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
}
