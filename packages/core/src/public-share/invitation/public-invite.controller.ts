import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Public } from '@gauzy/common';
import { PublicTransformInterceptor } from './../public-transform.interceptor';
import { FindPublicInviteByEmailTokenQuery } from './queries';
import { PublicInviteQueryDTO } from './dto';

@Public()
@UseInterceptors(PublicTransformInterceptor)
@Controller()
export class PublicInviteController {

	constructor(
		private readonly queryBus: QueryBus
	) {}

	@Get('validate')
	@Public()
	async validateInvite(@Query() options: PublicInviteQueryDTO) {
		return await this.queryBus.execute(
			new FindPublicInviteByEmailTokenQuery({
				email: options.email,
				token: options.token
			}, options.relations)
		);
	}
}