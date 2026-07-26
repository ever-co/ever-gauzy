import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID, IAiProviderCredential, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { AiProviderCredentialService } from './ai-provider-credential.service';
import {
	ConnectAiProviderCredentialDTO,
	CreateAiProviderCredentialDTO,
	UpdateAiProviderCredentialDTO
} from './dto';

/**
 * Per-tenant BYOK ("bring your own key") AI provider credential endpoints.
 *
 * All routes require the `AI_CHAT_SETTINGS` permission. API keys are stored
 * encrypted at rest and are NEVER returned decrypted — read responses only
 * contain a masked hint (`'••••' + last 4 characters`).
 */
@ApiTags('AI Chat Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.AI_CHAT_SETTINGS)
@Controller('/ai-chat/credentials')
export class AiProviderCredentialController {
	constructor(private readonly aiProviderCredentialService: AiProviderCredentialService) {}

	/**
	 * Retrieve the current tenant's AI provider credentials with masked API keys.
	 *
	 * @returns A paginated list of credentials; `apiKey` is always masked.
	 */
	@ApiOperation({ summary: "List the current tenant's AI provider credentials (API keys masked)." })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Credentials retrieved successfully. API keys are masked.'
	})
	@Get('/')
	async findAll(): Promise<IPagination<IAiProviderCredential>> {
		return await this.aiProviderCredentialService.findAllMasked();
	}

	/**
	 * Create or update the tenant's credential for a provider
	 * (one credential per provider per tenant).
	 *
	 * @param entity - The credential payload; the API key is encrypted before storage.
	 * @returns The persisted credential with a masked API key.
	 */
	@ApiOperation({ summary: 'Create or update (upsert) an AI provider credential for the current tenant.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The credential has been successfully saved. The API key is returned masked.'
	})
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
	@UseValidationPipe({ whitelist: true })
	@Post('/')
	async upsert(@Body() entity: CreateAiProviderCredentialDTO): Promise<IAiProviderCredential> {
		return await this.aiProviderCredentialService.upsert(entity);
	}

	/**
	 * Complete a provider "Connect" flow (e.g. OpenRouter PKCE): the backend
	 * exchanges the authorization code + PKCE verifier for an API key and
	 * stores it as the tenant's credential — the key never reaches the browser.
	 *
	 * @param entity - Provider id + PKCE code/verifier from the provider callback.
	 * @returns The persisted credential with a masked API key.
	 */
	@ApiOperation({ summary: "Complete a provider Connect flow and store the tenant's credential." })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Connected: the exchanged API key was stored (returned masked).'
	})
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Provider unknown or does not support Connect.' })
	@ApiResponse({ status: HttpStatus.BAD_GATEWAY, description: 'The provider rejected or failed the exchange.' })
	@UseValidationPipe({ whitelist: true })
	@Post('/connect')
	async connect(@Body() entity: ConnectAiProviderCredentialDTO): Promise<IAiProviderCredential> {
		return await this.aiProviderCredentialService.connectExchange(entity);
	}

	/**
	 * Update an existing AI provider credential by its ID.
	 *
	 * @param id - The UUID of the credential to update.
	 * @param entity - The fields to update; a provided API key is re-encrypted.
	 * @returns The updated credential with a masked API key.
	 */
	@ApiOperation({ summary: 'Update an AI provider credential.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The credential has been successfully updated. The API key is returned masked.'
	})
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@UseValidationPipe({ whitelist: true })
	@Put('/:id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateAiProviderCredentialDTO
	): Promise<IAiProviderCredential> {
		return await this.aiProviderCredentialService.updateCredential(id, entity);
	}

	/**
	 * Delete an AI provider credential by its ID.
	 *
	 * @param id - The UUID of the credential to delete.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Delete an AI provider credential.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The credential has been successfully deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.aiProviderCredentialService.delete(id);
	}
}
