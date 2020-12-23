import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Post,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Feature } from './feature.entity';
import { FeatureService } from './feature.service';
import * as unleash from 'unleash-client';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { AuthGuard } from '@nestjs/passport';
import { IFeatureOrganizationCreateInput } from '@gauzy/models';

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
	@UseGuards(AuthGuard('jwt'))
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
	@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
	@Get('/organizations')
	async getFeaturesOrganization(@Query('data') data: any) {
		return this.featureService.getFeatureOrganizations(data);
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
	@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
	@Post('action')
	async enabledDisabledFeature(
		@Body() input: IFeatureOrganizationCreateInput
	) {
		return this.featureService.updateFeatureOrganization(input);
	}
}
