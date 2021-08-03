import {
	Controller,
	Post,
	Body,
	UploadedFile,
	UseInterceptors,
	HttpStatus,
	UseGuards,
	Get,
	Query,
	Param
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UpworkTransactionService } from './upwork-transaction.service';
import { UpworkService } from './upwork.service';
import {
	IAccessToken,
	IAccessTokenSecretPair,
	IAccessTokenDto,
	IGetWorkDiaryDto,
	IGetContractsDto,
	IEngagement,
	IUpworkApiConfig,
	IUpworkClientSecretPair
} from '@gauzy/contracts';
import { Expense, Income } from './../core/entities/internal';
import { IPagination } from '../core';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('Integrations')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class UpworkController {
	constructor(
		private readonly _upworkTransactionService: UpworkTransactionService,
		private readonly _upworkService: UpworkService
	) {}

	@ApiOperation({ summary: 'Upload Upwork transaction.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Uploaded transaction'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Freelancer not found'
	})
	@Post('/transactions')
	@UseInterceptors(FileInterceptor('file'))
	async create(@UploadedFile() file, @Body() organizationDto): Promise<any> {
		return await this._upworkTransactionService.handleTransactions(
			file,
			organizationDto
		);
	}

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
		return await this._upworkService.getAccessTokenSecretPair(
			config,
			organizationId
		);
	}

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
		return await this._upworkService.getAccessToken(
			accessTokenDto,
			organizationId
		);
	}

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
	async getWorkDiary(
		@Query('data', ParseJsonPipe) data: IGetWorkDiaryDto
	): Promise<any> {
		return await this._upworkService.getWorkDiary(data);
	}

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
	async getContracts(
		@Query('data', ParseJsonPipe) data: IGetContractsDto
	): Promise<IEngagement[]> {
		return await this._upworkService.getContractsForFreelancer(data);
	}

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

	@ApiOperation({
		summary: 'Find all expense and income for logged upwork user.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found income & expense',
		type: Income || Expense
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
		return await this._upworkService.getReportListByIntegration(
			integrationId,
			filter,
			relations
		);
	}
}
