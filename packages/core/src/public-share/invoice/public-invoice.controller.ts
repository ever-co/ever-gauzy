import { BadRequestException, Controller, Get, HttpStatus, Param, Query, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Public } from '@gauzy/common';
import { FindOptionsWhere } from 'typeorm';
import { Invoice } from './../../core/entities/internal';
import { PublicTransformInterceptor } from './../public-transform.interceptor';
import { FindPublicInvoiceQuery } from './queries';
import { PublicInvoiceQueryDTO } from './dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Public()
@UseInterceptors(PublicTransformInterceptor)
@Controller()
export class PublicInvoiceController {

	constructor(
		private readonly queryBus: QueryBus
	) {}

	/**
	 * GET invoice by token
	 *
	 * @param params
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find Invoice by invoice token.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id/:token')
	async findOneByPublicLink(
		@Param() params: FindOptionsWhere<Invoice>,
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) query: PublicInvoiceQueryDTO
	) {
		try {
			return await this.queryBus.execute(
				new FindPublicInvoiceQuery(params, query.relations)
			);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}