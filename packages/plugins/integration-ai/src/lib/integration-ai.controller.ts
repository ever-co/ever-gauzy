import { Body, Controller, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	ID,
	IIntegrationAICreateInput,
	IIntegrationTenant,
	IIntegrationTenantUpdateInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { IntegrationAIService } from './integration-ai.service';

@ApiTags('Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller()
export class IntegrationAIController {
	constructor(private readonly _integrationAIService: IntegrationAIService) {}

	/**
	 * Create a new Integration AI entity.
	 *
	 * @param input - The data required to create a new Integration AI entity.
	 * @returns A promise that resolves to the created Integration Tenant entity.
	 */
	@ApiOperation({ summary: 'Create a new Integration AI entity' })
	@ApiResponse({
		status: 201,
		description: 'The Integration AI entity has been successfully created.'
	})
	@ApiResponse({ status: 400, description: 'Bad Request' })
	@ApiResponse({ status: 500, description: 'Internal Server Error' })
	@Post()
	async create(@Body() input: IIntegrationAICreateInput): Promise<IIntegrationTenant> {
		return await this._integrationAIService.create(input);
	}

	/**
	 * Update Gauzy AI integration by ID.
	 *
	 * @param id - The ID of the integration to update.
	 * @param input - The updated data for the integration.
	 * @returns A promise that resolves to the updated Integration Tenant entity.
	 */
	@ApiOperation({ summary: 'Update Gauzy AI integration.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Update Gauzy AI integration'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: IIntegrationTenantUpdateInput
	): Promise<IIntegrationTenant> {
		return await this._integrationAIService.update(id, input);
	}
}
