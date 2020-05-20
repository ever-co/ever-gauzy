import {
	Controller,
	Post,
	Body,
	UploadedFile,
	UseInterceptors,
	HttpStatus,
	UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UpworkTransactionService } from './upwork-transaction.service';
import { UpworkService } from './upwork.service';
import {
	IAccessToken,
	IAccessTokenSecretPair,
	IAccessTokenDto
} from '@gauzy/models';

@UseGuards(AuthGuard('jwt'))
@Controller()
export class UpworkController {
	constructor(
		private _upworkTransactionService: UpworkTransactionService,
		private _upworkService: UpworkService
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
	@Post('/token-secret-pair')
	async getAccessTokenSecretPair(
		@Body() config
	): Promise<IAccessTokenSecretPair> {
		return await this._upworkService.getAccessTokenSecretPair(config);
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
	@Post('/access-token')
	async getAccessToken(
		@Body() accessTokenDto: IAccessTokenDto
	): Promise<IAccessToken> {
		return await this._upworkService.getAccessToken(accessTokenDto);
	}
}
