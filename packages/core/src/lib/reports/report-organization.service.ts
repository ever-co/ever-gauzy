import { IOrganization, IReport, UpdateReportMenuInput } from '@gauzy/contracts';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum } from '../core/utils';
import { ReportOrganization } from './report-organization.entity';
import { MikroOrmReportOrganizationRepository } from './repository/mikro-orm-report-organization.repository';
import { MikroOrmReportRepository } from './repository/mikro-orm-report.repository';
import { TypeOrmReportOrganizationRepository } from './repository/type-orm-report-organization.repository';
import { TypeOrmReportRepository } from './repository/type-orm-report.repository';
import { assertCallerIsAuthorOrTenantAdmin, isCallerTenantAdmin } from '../shared/ownership';

@Injectable()
export class ReportOrganizationService extends TenantAwareCrudService<ReportOrganization> {
    constructor(
        private readonly typeOrmReportRepository: TypeOrmReportRepository,
        private readonly mikroOrmReportRepository: MikroOrmReportRepository,
        private readonly typeOrmReportOrganizationRepository: TypeOrmReportOrganizationRepository,
        private readonly mikroOrmReportOrganizationRepository: MikroOrmReportOrganizationRepository,
    ) {
        super(typeOrmReportOrganizationRepository, mikroOrmReportOrganizationRepository);
    }

    /**
     * Updates an existing report menu entry if it exists, otherwise creates a new one.
     *
     * An entry switches one report on or off in the menu of a whole organization, and the route states no
     * permission (GHSA-v79w-54p2-wmh5: any signed-in member of the tenant could hide or show any report for
     * everyone). Owner decision 2 (2026-10-22): an entry is changed only by its author — the user who created it
     * (`createdByUserId`; the entries made with the organization are the creator's) — or a tenant administrator.
     * An entry that does not exist yet has no author, so only a tenant administrator creates one. A change writes
     * the entry's switch (`isEnabled`) and nothing else: the report and the organization it is for are its key,
     * and its tenant and author are not the caller's to restate.
     *
     * @param input The input containing data for updating or creating the report menu entry.
     * @returns The updated or newly created report menu entry.
     * @throws ForbiddenException when the caller may not change the entry, or create a missing one.
     */
    async updateReportMenu(input: UpdateReportMenuInput): Promise<ReportOrganization> {
        const { reportId, organizationId } = input;
        // The body is not DTO-validated: both keys must be present, or the lookup below (an empty
        // key used to be dropped from the where) would pick an arbitrary row of the tenant to mutate.
        if (!reportId || !organizationId) {
            throw new BadRequestException('reportId and organizationId are required');
        }

        const tenantId = RequestContext.currentTenantId() || input.tenantId;

        let reportOrganization: ReportOrganization | null = null;
        try {
            reportOrganization = await this.findOneByWhereOptions({
                reportId,
                organizationId,
                tenantId
            });
        } catch (error) {
            // A missing entry is created below; any other failure is the lookup's own
            if (!(error instanceof NotFoundException)) {
                throw error;
            }
        }

        if (reportOrganization) {
            // Only its author, or a tenant administrator, may switch an existing entry
            assertCallerIsAuthorOrTenantAdmin({ userId: reportOrganization.createdByUserId }, 'this report menu entry');

            // If the report organization exists, update its switch with the input data
            if (input.isEnabled !== undefined) {
                reportOrganization.isEnabled = input.isEnabled;
            }
            return await super.save(new ReportOrganization(reportOrganization));
        }

        // A missing entry speaks for the whole organization and has no author yet
        if (!isCallerTenantAdmin()) {
            throw new ForbiddenException('Only a tenant administrator may add a report to the organization menu');
        }

        // If the report organization doesn't exist, create a new one with the input data
        return await super.create(
            new ReportOrganization(input)
        );
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
            let reports: IReport[];
            switch (this.ormType) {
                case MultiORMEnum.MikroORM:
                    reports = await this.mikroOrmReportRepository.findAll();
                    break;
                case MultiORMEnum.TypeORM:
                default:
                    reports = await this.typeOrmReportRepository.find();
                    break;
            }

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
            switch (this.ormType) {
                case MultiORMEnum.MikroORM: {
                    const em = this.mikroOrmReportOrganizationRepository.getEntityManager();
                    reportOrganizations.forEach((ro) => em.persist(ro));
                    await em.flush();
                    return reportOrganizations;
                }
                case MultiORMEnum.TypeORM:
                default:
                    return await this.typeOrmReportOrganizationRepository.save(reportOrganizations);
            }
        } catch (error) {
            console.log(`Error occurred while attempting bulk creation of organization reports: ${error?.message}`);
            // Throw InternalServerErrorException if an error occurs
            throw new BadRequestException(error);
        }
    }
}
