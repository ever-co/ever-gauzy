import { CrudController } from '../core';
import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { EstimateEmail } from './estimate-email.entity';
import { EstimateEmailService } from './estimate-email.service';

@ApiTags('Invoice')
@Controller()
export class EstimateEmailController extends CrudController<EstimateEmail> {
	constructor(private estimateEmailService: EstimateEmailService) {
		super(estimateEmailService);
	}

	@Get('validate')
	async validateEstimateEmail(
		@Query('data') data: string
	): Promise<EstimateEmail> {
		const {
			relations,
			findInput: { email, token }
		} = JSON.parse(data);

		if (!email && !token) {
			throw new BadRequestException('Email & Token Mandatory');
		}

		return this.estimateEmailService.validate(relations, email, token);
	}
}
