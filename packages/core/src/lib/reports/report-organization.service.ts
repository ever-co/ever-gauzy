import { BadRequestException, Injectable, } from '@nestjs/common';
import { IOrganization, IReport, UpdateReportMenuInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { ReportOrganization } from './report-organization.entity';
import { TypeOrmReportRepository } from './repository/type-orm-report.repository';
import { TypeOrmReportOrganizationRepository } from './repository/type-orm-report-organization.repository';
import { MikroOrmReportOrganizationRepository } from './repository/mikro-orm-report-organization.repository';

@Injectable()
export class ReportOrganizationService extends TenantAwareCrudService<ReportOrganization> {
    constructor(
        private readonly typeOrmReportRepository: TypeOrmReportRepository,
        private readonly typeOrmReportOrganizationRepository: TypeOrmReportOrganizationRepository,
        private readonly mikroOrmReportOrganizationRepository: MikroOrmReportOrganizationRepository,
    ) {
        super(typeOrmReportOrganizationRepository, mikroOrmReportOrganizationRepository);
    }

    /**
     * Updates an existing report menu entry if it exists, otherwise creates a new one.
     * @param input The input containing data for updating or creating the report menu entry.
     * @returns The updated or newly created report menu entry.
     */
    async updateReportMenu(input: UpdateReportMenuInput): Promise<ReportOrganization> {
        try {
            const { reportId, organizationId } = input;
            const tenantId = RequestContext.currentTenantId() || input.tenantId;

            let reportOrganization = await this.findOneByWhereOptions({
                reportId,
                organizationId,
                tenantId
            });

            // If the report organization exists, update it with the input data
            reportOrganization = new ReportOrganization(
                Object.assign(reportOrganization, input)
            );
            return await super.save(reportOrganization);
        } catch (error) {
            // If the report organization doesn't exist, create a new one with the input data
            return await super.create(
                new ReportOrganization(input)
            );
        }
    }

    /**
     * Bulk create organization default reports menu.
     *
     * @param input - The organization input data.
     * @returns A promise that resolves to an array of created ReportOrganization instances.
     */
    async bulkCreateOrganizationReport(input: IOrganization): Promise<ReportOrganization[]> {
        try {
            const { id: organizationId, tenantId } = input;

            // Fetch reports from the database
            const reports: IReport[] = await this.typeOrmReportRepository.find();

            // Create ReportOrganization instances based on fetched reports
            const reportOrganizations: ReportOrganization[] = reports.map((report: IReport) =>
                new ReportOrganization({
                    report: { id: report.id },
                    isEnabled: true,
                    organizationId,
                    tenantId
                })
            );

            // Save the created ReportOrganization instances to the database
            return await this.typeOrmReportOrganizationRepository.save(reportOrganizations);
        } catch (error) {
            console.log(`Error occurred while attempting bulk creation of organization reports: ${error?.message}`);
            // Throw InternalServerErrorException if an error occurs
            throw new BadRequestException(error);
        }
    }
}
