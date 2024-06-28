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
	PermissionsEnum
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
	async create(@UploadedFile() file: any, @Body() organizationDto: any): Promise<any> {
		return await this._upworkTransactionService.handleTransactions(file, organizationDto);
	}

	/**
	 *
	 * @param config
	 * @param organizationId
	 * @returns
	 */
	@ApiOperation({ summary: 'Authorize Upwork.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Authorized Upwork'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Cannot Authorize'
	})
	@Post('/token-secret-pair/:organizationId')
	async getAccessTokenSecretPair(
		@Body() config: IUpworkClientSecretPair,
		@Param('organizationId', UUIDValidationPipe) organizationId: string
	): Promise<IAccessTokenSecretPair> {
		return await this._upworkService.getAccessTokenSecretPair(config, organizationId);
	}

	/**
	 *
	 * @param accessTokenDto
	 * @param organizationId
	 * @returns
	 */
	@ApiOperation({ summary: 'Get Access Token.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Get Access Token'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request'
	})
	@Post('/access-token/:organizationId')
	async getAccessToken(
		@Body() accessTokenDto: IAccessTokenDto,
		@Param('organizationId', UUIDValidationPipe) organizationId: string
	): Promise<IAccessToken> {
		return await this._upworkService.getAccessToken(accessTokenDto, organizationId);
	}

	/**
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Get Work Diary.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Get Work Diary'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request'
	})
	@Get('work-diary')
	async getWorkDiary(@Query('data', ParseJsonPipe) data: IGetWorkDiaryDto): Promise<any> {
		return await this._upworkService.getWorkDiary(data);
	}

	/**
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Get Contracts.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Get Contracts'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request'
	})
	@Get('freelancer-contracts')
	async getContracts(@Query('data', ParseJsonPipe) data: IGetContractsDto): Promise<IEngagement[]> {
		return await this._upworkService.getContractsForFreelancer(data);
	}

	/**
	 *
	 * @param integrationId
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Get Config.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Get Config'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request'
	})
	@Get('config/:integrationId')
	async getConfig(
		@Param('integrationId', UUIDValidationPipe) integrationId: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IUpworkApiConfig> {
		const { filter } = data;
		return await this._upworkService.getConfig(integrationId, filter);
	}

	/**
	 *
	 * @param syncContractsDto
	 * @returns
	 */
	@ApiOperation({ summary: 'Sync Contracts.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Sync Contracts'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request'
	})
	@Post('sync-contracts')
	async syncContracts(@Body() syncContractsDto: any): Promise<any> {
		return await this._upworkService.syncContracts(syncContractsDto);
	}

	/**
	 *
	 * @param dto
	 * @returns
	 */
	@ApiOperation({ summary: 'Sync Contracts Related Data.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Sync Contracts Related Data'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request'
	})
	@Post('sync-contracts-related-data')
	async syncContractsRelatedData(@Body() dto): Promise<any> {
		return await this._upworkService.syncContractsRelatedData(dto);
	}

	/**
	 *
	 * @param integrationId
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all expense and income for logged upwork user.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found income & expense'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request'
	})
	@Get('report/:integrationId')
	async getReports(
		@Param('integrationId', UUIDValidationPipe) integrationId: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<any>> {
		const { relations, filter } = data;
		return await this._upworkService.getReportListByIntegration(integrationId, filter, relations);
	}
}
