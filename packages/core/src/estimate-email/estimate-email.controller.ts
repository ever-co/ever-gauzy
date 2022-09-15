import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { Public } from '@gauzy/common';
import { EstimateEmailService } from './estimate-email.service';
import { FindEstimateEmailQueryDTO } from './dto';

@ApiTags('EstimateEmail')
@Public()
@Controller()
export class EstimateEmailController {

	constructor(
		private readonly estimateEmailService: EstimateEmailService
	) {}

	/**
	 * Validate estimate email request
	 *
	 * @param params
	 * @returns
	 */
	@Get('validate')
	async validateEstimateEmail(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) params: FindEstimateEmailQueryDTO
	) {
		return await this.estimateEmailService.validate(
			params,
			params.relations
		);
	}
}
