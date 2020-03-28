import {
	Controller,
	Post,
	Body,
	UploadedFile,
	UseInterceptors,
	HttpStatus
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpworkService } from './upwork.service';

@Controller()
export class UpworkController {
	constructor(private _upworkService: UpworkService) {}

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
	@Post('/upwork-transactions')
	@UseInterceptors(FileInterceptor('file'))
	async create(@UploadedFile() file, @Body() organizationDto): Promise<any> {
		return await this._upworkService.handleTransactions(
			file,
			organizationDto
		);
	}
}
