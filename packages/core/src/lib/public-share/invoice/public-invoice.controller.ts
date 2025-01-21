import { UseInterceptors, Controller, Get, Param, Query, Put, Body } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Public } from '@gauzy/common';
import { FindOptionsWhere, UpdateResult } from 'typeorm';
import { HttpStatus, IInvoice } from '@gauzy/contracts';
import { Invoice } from './../../core/entities/internal';
import { UseValidationPipe } from '../../shared/pipes';
import { PublicTransformInterceptor } from './../public-transform.interceptor';
import { FindPublicInvoiceQuery } from './queries';
import { PublicInvoiceUpdateCommand } from './commands';
import { PublicEstimateUpdateDTO, PublicInvoiceQueryDTO } from './dto';

@Public()
@UseInterceptors(PublicTransformInterceptor)
@Controller('/public/invoice')
export class PublicInvoiceController {
	constructor(private readonly queryBus: QueryBus, private readonly commandBus: CommandBus) {}

	/**
	 * GET invoice by token
	 *
	 * @param params
	 * @param query
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
	@UseValidationPipe({ transform: true, whitelist: true })
	async findOneByPublicLink(
		@Param() params: FindOptionsWhere<Invoice>,
		@Query() query: PublicInvoiceQueryDTO
	): Promise<IInvoice> {
		return await this.queryBus.execute(new FindPublicInvoiceQuery(params, query.relations));
	}

	/**
	 * Update public estimate/invoice status
	 *
	 * @param params
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update Estimate by estimate token.' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Estimate updated successfully.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found.'
	})
	@Put(':id/:token')
	@UseValidationPipe({ whitelist: true })
	async updateInvoiceByEstimateEmailToken(
		@Param() params: IInvoice,
		@Body() entity: PublicEstimateUpdateDTO
	): Promise<IInvoice | UpdateResult> {
		return await this.commandBus.execute(new PublicInvoiceUpdateCommand(params, entity));
	}
}
