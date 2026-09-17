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
	IUpworkApiConfigStatus,
	IUpworkClientSecretPair,
	IUpworkSyncContractsDto,
	IUpworkSyncContractsRelatedDataDto,
	IPagination,
	PermissionsEnum,
	IIntegrationMap
} from '@gauzy/contracts';
import { ParseJsonPipe, PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { UpworkTransactionService } from './upwork-transaction.service';
import { UpworkService } from './upwork.service';

@ApiTags('Upwork Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
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
		// The incomes and expenses land in the organization named by the body, so it must be one the caller may act on.
		await this._upworkService.assertOrganizationAccess(organizationDto?.organizationId);
		return await this._upworkTransactionService.handleTransactions(file, organizationDto);
	}

	/**
	 * Starts the Upwork OAuth handshake, or names the integration that already completed it.
	 *
	 * @param config - The Upwork consumer key and secret typed into the authorize form.
	 * @param organizationId - The ID of the organization.
	 * @returns The authorization URL to send the operator to, or the existing integration id. Never
	 *          a request-token secret or an access token (GHSA-3rqg-gpm9-gx84).
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
	 * Completes the Upwork OAuth handshake for the specified organization.
	 *
	 * @param accessTokenDto - The request token and verifier Upwork's callback handed back.
	 * @param organizationId - The ID of the organization.
	 * @returns The id of the integration now holding the access token. The token itself stays on
	 *          the server (GHSA-3rqg-gpm9-gx84).
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
	 * Retrieves the work diary for the specified integration and contract.
	 *
	 * @param data - The integration, organization, contract and date to read. It carries no
	 *               credentials: the server resolves those from the integration id.
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
	 * Retrieves the freelancer contracts for the specified integration.
	 *
	 * @param data - The integration and organization to read the contracts for. It carries no
	 *               credentials: the server resolves those from the integration id.
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
	 * Retrieves the non-secret configuration state of the specified Upwork integration.
	 *
	 * 🛑 This route must never answer with credential material. It reports whether the integration
	 * is connected and usable; anything credential-derived that stays visible is masked
	 * (GHSA-3rqg-gpm9-gx84).
	 *
	 * @param integrationId - The UUID of the integration.
	 * @param data - The query parameters, parsed as JSON. Only `filter.organizationId` is read.
	 * @returns A promise that resolves with the secret-free configuration state.
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
	): Promise<IUpworkApiConfigStatus> {
		const { filter } = data ?? {};
		return await this._upworkService.getConfig(integrationId, filter?.organizationId);
	}

	/**
	 * Syncs Upwork contracts into projects of the specified organization.
	 *
	 * @param syncContractsDto - The integration, organization and contracts to sync. A tenant in the
	 *                           body is ignored: the server takes it from the request context.
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
	async syncContracts(@Body() syncContractsDto: IUpworkSyncContractsDto): Promise<IIntegrationMap[]> {
		return await this._upworkService.syncContracts(syncContractsDto);
	}

	/**
	 * Syncs contracts related data with the provided data transfer object.
	 *
	 * @param dto - The integration, organization, contracts and entities to sync. It carries no
	 *              credentials: the server resolves those from the integration id.
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
	async syncContractsRelatedData(@Body() dto: IUpworkSyncContractsRelatedDataDto): Promise<any> {
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
