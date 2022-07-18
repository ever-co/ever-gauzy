import { IEmployee, IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPublicEmployeesByOrganizationQuery } from '../get-public-employees-by-organization.query';
import { PublicEmployeeService } from '../../public-employee.service';

@QueryHandler(GetPublicEmployeesByOrganizationQuery)
export class GetPublicEmployeesByOrganizationHandler implements IQueryHandler<GetPublicEmployeesByOrganizationQuery> {

    constructor(
        private readonly publicEmployeeService: PublicEmployeeService
    ) {}

    async execute(query: GetPublicEmployeesByOrganizationQuery): Promise<IPagination<IEmployee>> {
        const { params, options } = query;
        return await this.publicEmployeeService.getAllPublicEmployeeByOrganizationProfile(
            params,
            options
        );
    }
}