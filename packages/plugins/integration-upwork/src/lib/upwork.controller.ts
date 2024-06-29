import {
	Controller,
	Post,
	Body,
	UploadedFile,
	UseInterceptors,
	HttpStatus,
	Get,
	Query,
	Param,
	UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Express } from 'express';
import {
	IAccessToken,
	IAccessTokenSecretPair,
	IAccessTokenDto,
	IGetWorkDiaryDto,
	IGetContractsDto,
	IEngagement,
	IUpworkApiConfig,
	IUpworkClientSecretPair,
	IPagination,
	PermissionsEnum,
	IIntegrationMap
} from '@gauzy/contracts';
import { ParseJsonPipe, PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { UpworkTransactionService } from './upwork-transaction.service';
import { UpworkService } from './upwork.service';

@ApiTags('Upwork Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller('/integrations/upwork')
export class UpworkController {
	constructor(
		private readonly _upworkTransactionService: UpworkTransactionService,
		private readonly _upworkService: UpworkService
	) {}

	/**
	 * Handles the uploading of Upwork transactions.
	 *
	 * @param file - The uploaded file containing transaction data.
	 * @param organizationDto - The DTO containing organization information.
	 * @returns A promise that resolves with the result of handling the transactions.
	 */
	@ApiOperation({ summary: 'Upload Upwork transaction' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The transaction has been successfully uploaded.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'The specified record was not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'The request was invalid or the freelancer was not found.'
	})
	@Post('/transactions')
	@UseInterceptors(FileInterceptor('file'))
	async create(@UploadedFile() file: Express.Multer.File, @Body() organizationDto: any): Promise<any> {
		return await this._upworkTransactionService.handleTransactions(file, organizationDto);
	}

	/**
	 * Authorizes Upwork by generating an access token and secret pair.
	 *
	 * @param config - The configuration containing client secret pair.
	 * @param organizationId - The ID of the organization.
	 * @returns A promise that resolves with the access token and secret pair.
	 */
	@ApiOperation({ summary: 'Authorize Upwork' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The Upwork account has been successfully authorized.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'The specified record was not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Authorization failed due to invalid request.'
	})
	@Post('/token-secret-pair/:organizationId')
	async getAccessTokenSecretPair(
		@Body() config: IUpworkClientSecretPair,
		@Param('organizationId', UUIDValidationPipe) organizationId: string
	): Promise<IAccessTokenSecretPair> {
		return await this._upworkService.getAccessTokenSecretPair(config, organizationId);
	}

	/**
	 * Retrieves the access token for the specified organization.
	 *
	 * @param accessTokenDto - The DTO containing the access token information.
	 * @param organizationId - The ID of the organization.
	 * @returns A promise that resolves with the access token.
	 */
	@ApiOperation({ summary: 'Get Access Token' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The access token has been successfully retrieved.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'The specified record was not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request.'
	})
	@Post('/access-token/:organizationId')
	async getAccessToken(
		@Body() accessTokenDto: IAccessTokenDto,
		@Param('organizationId', UUIDValidationPipe) organizationId: string
	): Promise<IAccessToken> {
		return await this._upworkService.getAccessToken(accessTokenDto, organizationId);
	}

	/**
	 * Retrieves the work diary for the specified data.
	 *
	 * @param data - The DTO containing the query parameters for the work diary.
	 * @returns A promise that resolves with the work diary data.
	 */
	@ApiOperation({ summary: 'Get Work Diary' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Work Diary retrieved successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'The specified record was not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request.'
	})
	@Get('/work-diary')
	async getWorkDiary(@Query('data', ParseJsonPipe) data: IGetWorkDiaryDto): Promise<any> {
		return await this._upworkService.getWorkDiary(data);
	}

	/**
	 * Retrieves the contracts for the specified data.
	 *
	 * @param data - The DTO containing the query parameters for the contracts.
	 * @returns A promise that resolves with the list of engagements.
	 */
	@ApiOperation({ summary: 'Get Contracts' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Contracts retrieved successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'The specified record was not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request.'
	})
	@Get('/freelancer-contracts')
	async getContracts(@Query('data', ParseJsonPipe) data: IGetContractsDto): Promise<IEngagement[]> {
		return await this._upworkService.getContractsForFreelancer(data);
	}

	/**
	 * Retrieves the configuration for the specified integration ID.
	 *
	 * @param integrationId - The UUID of the integration.
	 * @param data - The query parameters, parsed as JSON.
	 * @returns A promise that resolves with the configuration data.
	 */
	@ApiOperation({ summary: 'Get Config' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Configuration retrieved successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'The specified record was not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request.'
	})
	@Get('/config/:integrationId')
	async getConfig(
		@Param('integrationId', UUIDValidationPipe) integrationId: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IUpworkApiConfig> {
		const { filter } = data;
		return await this._upworkService.getConfig(integrationId, filter);
	}

	/**
	 * Syncs contracts with the provided data.
	 *
	 * @param syncContractsDto - The data transfer object containing contract details to sync.
	 * @returns A promise that resolves with the result of the synchronization process.
	 */
	@ApiOperation({ summary: 'Sync Contracts' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Contracts have been successfully synced.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'The specified record was not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'The request is invalid.'
	})
	@Post('/sync-contracts')
	async syncContracts(@Body() syncContractsDto: any): Promise<IIntegrationMap[]> {
		return await this._upworkService.syncContracts(syncContractsDto);
	}

	/**
	 * Syncs contracts related data with the provided data transfer object.
	 *
	 * @param dto - The data transfer object containing details for contracts related data synchronization.
	 * @returns A promise that resolves with the result of the synchronization process.
	 */
	@ApiOperation({ summary: 'Sync Contracts Related Data' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Contracts related data have been successfully synced.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'The specified record was not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'The request is invalid.'
	})
	@Post('/sync-contracts-related-data')
	async syncContractsRelatedData(@Body() dto: any): Promise<any> {
		return await this._upworkService.syncContractsRelatedData(dto);
	}

	/**
	 * Retrieves income and expense reports for the specified Upwork integration.
	 *
	 * @param integrationId - The ID of the Upwork integration.
	 * @param data - Optional query parameters for filtering and relations.
	 * @returns A promise that resolves with the paginated list of income and expense reports.
	 */

	@ApiOperation({
		summary: 'Find all expenses and incomes for logged Upwork user.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved income and expense data.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'The specified record was not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'The request is invalid.'
	})
	@Get('/report/:integrationId')
	async getReports(
		@Param('integrationId', UUIDValidationPipe) integrationId: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<any>> {
		const { relations, filter } = data;
		return await this._upworkService.getReportListByIntegration(integrationId, filter, relations);
	}
}
