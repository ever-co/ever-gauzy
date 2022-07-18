import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindOnePublicEmployeeQuery } from '../find-one-public-employee.query';
import { PublicEmployeeService } from './../../public-employee.service';

@QueryHandler(FindOnePublicEmployeeQuery)
export class FindOnePublicEmployeeHandler implements IQueryHandler<FindOnePublicEmployeeQuery> {

    constructor(
        private readonly publicEmployeeService: PublicEmployeeService
    ) {}

    async execute(query: FindOnePublicEmployeeQuery) {
        const { params, options } = query;
        console.log({ params, options });
    }
}