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
import { FeatureInterface } from 'unleash-client/lib/feature';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { AuthGuard } from '@nestjs/passport';
import { FeatureEnum, IFeatureOrganizationUpdateInput } from '@gauzy/models';
import { CommandBus } from '@nestjs/cqrs';
import { FeatureToggleUpdateCommand } from './commands/feature-toggle.update.command';

@ApiTags('Feature')
@Controller()
export class FeaturesToggleController {
	constructor(
		private readonly featureService: FeatureService,
		private readonly commandBus: CommandBus
	) {}

	@Get()
	async get() {
		let featureToggles: FeatureInterface[] = unleash.getFeatureToggleDefinitions();

		//only support gauzy feature and removed other
		const featureEnums: string[] = Object.values(FeatureEnum);
		if (featureToggles) {
			featureToggles = featureToggles.filter((toggle: FeatureInterface) =>
				featureEnums.includes(toggle.name)
			);
		}
		return featureToggles;
	}

	@ApiOperation({ summary: 'Find all parent features.' })
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
	@Get('parent')
	async getParentFeatureList(@Query('data') data: any) {
		return this.featureService.getParentFeatureList(data);
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
	async getAllFeatureList() {
		return this.featureService.getAllFeatureList();
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
		description: 'The record has been successfully created/updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
	@Post()
	async enabledDisabledFeature(
		@Body() input: IFeatureOrganizationUpdateInput
	) {
		return this.commandBus.execute(new FeatureToggleUpdateCommand(input));
	}
}
