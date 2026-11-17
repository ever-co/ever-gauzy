import { UseInterceptors, Controller, Get, Param, Query, Put, Body, NotFoundException, Res } from '@nestjs/common';
import { Response } from 'express';
import { I18nLang } from 'nestjs-i18n';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Public } from '@gauzy/common';
import { FindOptionsWhere, UpdateResult } from 'typeorm';
import { HttpStatus, IInvoice, LanguagesEnum } from '@gauzy/contracts';
import { Invoice } from './../../core/entities/internal';
import { UseValidationPipe, UUIDValidationPipe } from '../../shared/pipes';
import { InvoiceService } from '../../invoice/invoice.service';
import { PublicInvoiceService } from './public-invoice.service';
import { PublicTransformInterceptor } from './../public-transform.interceptor';
import { FindPublicInvoiceQuery } from './queries';
import { PublicInvoiceUpdateCommand } from './commands';
import { PublicEstimateUpdateDTO, PublicInvoiceQueryDTO } from './dto';

@Public()
@UseInterceptors(PublicTransformInterceptor)
@Controller('/public/invoice')
export class PublicInvoiceController {
	constructor(
		private readonly queryBus: QueryBus,
		private readonly commandBus: CommandBus,
		private readonly publicInvoiceService: PublicInvoiceService,
		private readonly invoiceService: InvoiceService
	) {}

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
	 * Each answer that changes the estimate tells the team (in-app and by email), so a link holder flipping it is held to
	 * a per-address budget of its own, where throttling is on.
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
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@Put(':id/:token')
	@UseValidationPipe({ whitelist: true })
	async updateInvoiceByEstimateEmailToken(
		@Param() params: IInvoice,
		@Body() entity: PublicEstimateUpdateDTO
	): Promise<IInvoice | UpdateResult> {
		return await this.commandBus.execute(new PublicInvoiceUpdateCommand(params, entity));
	}
	/**
	 * The invoice as a PDF, through its share link: the public page offers it to the client. The link is checked as the
	 * read checks it (a revoked link, or a voided invoice's, is refused), and each download renders the PDF, so a link
	 * holder is held to a per-address budget of its own, where throttling is on.
	 */
	@ApiOperation({ summary: 'Download an invoice as a PDF through its share link' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The PDF' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The link does not open the invoice' })
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	@Get(':id/:token/download')
	async downloadByPublicLink(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('token') token: string,
		@I18nLang() language: LanguagesEnum,
		@Res() res: Response
	): Promise<void> {
		const invoice = await this.publicInvoiceService.findOneByConditions({ id, token });
		const pdf = await this.invoiceService.generateTenantInvoicePdf(invoice.id, invoice.tenantId, language);
		if (!pdf) {
			throw new NotFoundException();
		}
		res.set({
			'Content-Type': 'application/pdf',
			'Content-Length': String(pdf.length),
			'Cache-Control': 'no-store'
		});
		res.end(pdf);
	}
}
