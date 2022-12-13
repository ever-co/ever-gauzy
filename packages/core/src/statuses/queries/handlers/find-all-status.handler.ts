
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IPagination, IStatus } from '@gauzy/contracts';
import { StatusService } from './../../status.service';
import { FindAllStatusQuery } from '../find-all-status.query';

@QueryHandler(FindAllStatusQuery)
export class FindAllStatusHandler implements IQueryHandler<FindAllStatusQuery> {

    constructor(
        private readonly statusService: StatusService
    ) {}

    async execute(query: FindAllStatusQuery): Promise<IPagination<IStatus>> {
        const { options } = query;
        return await this.statusService.findAll(options);
    }
}