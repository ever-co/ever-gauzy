import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Feature } from './feature.entity';
import { FeatureService } from './feature.service';

const { getFeatureToggleDefinitions } = require('unleash-client');

@ApiTags('Feature')
@Controller()
export class FeaturesToggleController {
	constructor(private readonly featureService: FeatureService) {}

	@Get()
	async get() {
		const featureToggles = getFeatureToggleDefinitions();
		return featureToggles;
	}

	@ApiOperation({ summary: 'Find all features.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found feature',
		type: Feature
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('all')
	async getAllFeaturesList() {
		return this.featureService.getAll();
	}
}
