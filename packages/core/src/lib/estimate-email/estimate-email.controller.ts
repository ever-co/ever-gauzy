import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '@gauzy/common';
import { IEstimateEmail } from '@gauzy/contracts';
import { UseValidationPipe } from '../shared/pipes';
import { EstimateEmailService } from './estimate-email.service';
import { FindEstimateEmailQueryDTO } from './dto';

@ApiTags('EstimateEmail')
@Public()
@Controller('/estimate-email')
export class EstimateEmailController {
	constructor(private readonly estimateEmailService: EstimateEmailService) {}

	/**
	 * Validate estimate email request
	 *
	 * @param params
	 * @returns
	 */
	@Get('/validate')
	@UseValidationPipe({ transform: true, whitelist: true })
	async validateEstimateEmail(@Query() params: FindEstimateEmailQueryDTO): Promise<IEstimateEmail> {
		return await this.estimateEmailService.validate(params, params.relations);
	}
}
