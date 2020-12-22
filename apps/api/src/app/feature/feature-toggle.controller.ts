import { Body, Controller, Get, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Feature } from './feature.entity';
import { FeatureService } from './feature.service';
import * as unleash from 'unleash-client';
import { RequestContext } from '../core/context';

@ApiTags('Feature')
@Controller()
export class FeaturesToggleController {
	constructor(private readonly featureService: FeatureService) {}

	@Get()
	async get() {
		const featureToggles = unleash.getFeatureToggleDefinitions();
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
	async getAllFeaturesList(@Query('data') data: any) {
		return this.featureService.getAll(data);
	}

	@ApiOperation({ summary: 'Find all feature organizations.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found feature',
		type: Feature
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/organizations')
	async getFeaturesOrganization() {
		const tenantId = RequestContext.currentTenantId();
		return this.featureService.getFeatureOrganizations(tenantId);
	}

	@ApiOperation({ summary: 'Enabled or disabled features' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description:
			'The record has been successfully created/updated.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	async enabledDisabledFeature(@Body() input: any) {}
}
