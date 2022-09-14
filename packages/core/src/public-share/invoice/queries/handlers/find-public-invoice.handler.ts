import { IInvoice } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindPublicInvoiceQuery } from '../find-public-invoice.query';
import { PublicInvoiceService } from './../../public-invoice.service';

@QueryHandler(FindPublicInvoiceQuery)
export class FindPublicInvoiceHandler implements IQueryHandler<FindPublicInvoiceQuery> {

    constructor(
        private readonly publicInvoiceService: PublicInvoiceService
    ) {}

    async execute(query: FindPublicInvoiceQuery): Promise<IInvoice> {
        const { params, relations = [] } = query;
        return await this.publicInvoiceService.findOneByConditions(params, relations);
    }
}