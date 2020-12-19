import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

const { getFeatureToggleDefinitions } = require('unleash-client');

@ApiTags('Feature Toggle')
@Controller()
export class FeaturesToggleController {
	constructor() {}

	@Get()
	async get() {
		const featureToggles = getFeatureToggleDefinitions();
		return featureToggles;
	}
}
