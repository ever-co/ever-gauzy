import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportOrganization } from '../report-organization.entity';

@Injectable()
export class TypeOrmReportOrganizationRepository extends Repository<ReportOrganization> {
    constructor(@InjectRepository(ReportOrganization) readonly repository: Repository<ReportOrganization>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
