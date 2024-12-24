import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IEmployee } from '@gauzy/contracts';
import { FindOnePublicEmployeeQuery } from '../find-one-public-employee.query';
import { PublicEmployeeService } from './../../public-employee.service';

@QueryHandler(FindOnePublicEmployeeQuery)
export class FindOnePublicEmployeeHandler implements IQueryHandler<FindOnePublicEmployeeQuery> {

    constructor(
        private readonly publicEmployeeService: PublicEmployeeService
    ) {}

    async execute(query: FindOnePublicEmployeeQuery): Promise<IEmployee> {
        const { params, relations = [] } = query;
        return await this.publicEmployeeService.findOneByConditions(params, relations);
    }
}