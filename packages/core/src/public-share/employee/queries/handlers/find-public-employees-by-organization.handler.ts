import { IEmployee, IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindPublicEmployeesByOrganizationQuery } from '../find-public-employees-by-organization.query';
import { PublicEmployeeService } from '../../public-employee.service';

@QueryHandler(FindPublicEmployeesByOrganizationQuery)
export class FindPublicEmployeesByOrganizationHandler implements IQueryHandler<FindPublicEmployeesByOrganizationQuery> {

    constructor(
        private readonly publicEmployeeService: PublicEmployeeService
    ) {}

    async execute(query: FindPublicEmployeesByOrganizationQuery): Promise<IPagination<IEmployee>> {
        const { options, relations = [] } = query;
        return await this.publicEmployeeService.findPublicEmployeeByOrganization(
            options,
            relations
        );
    }
}