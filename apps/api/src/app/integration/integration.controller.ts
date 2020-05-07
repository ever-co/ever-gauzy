import {
	Controller,
	HttpStatus,
	Get,
	Query,
	Param,
	UseGuards
} from '@nestjs/common';
import { CrudController } from '../core';
import { Integration } from './integration.entity';
import { IntegrationService } from './integration.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller()
export class IntegrationController extends CrudController<Integration> {
	constructor(private integrationService: IntegrationService) {
		super(integrationService);
	}

	@ApiOperation({ summary: 'Find integration.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: Integration
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async getById(
		@Param('id') id,
		@Query('data') data: string
	): Promise<Integration> {
		const { relations } = JSON.parse(data);

		return this.integrationService.findOne(id, {
			relations
		});
	}
}
