import {
	Controller,
	Post,
	Body,
	UploadedFile,
	UseInterceptors,
	HttpStatus
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { IntegrationsService } from './integrations.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('integrations')
export class IntegrationsController {
	constructor(private _integrationsService: IntegrationsService) {}

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
		const filePath = `./apps/api/src/app/integrations/csv/${file.originalname}`;
		const csvData = file.buffer.toString();

		fs.writeFileSync(filePath, csvData);

		return await this._integrationsService.handleTransactions(
			filePath,
			organizationDto
		);
	}
}
