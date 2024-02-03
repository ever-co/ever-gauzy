import { Column, RelationId, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IReport, IReportOrganization } from '@gauzy/contracts';
import { Report, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmReportOrganizationRepository } from './repository/mikro-orm-report-organization.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('report_organization', { mikroOrmRepository: () => MikroOrmReportOrganizationRepository })
export class ReportOrganization extends TenantOrganizationBaseEntity implements IReportOrganization {

	@ApiProperty({ type: () => Report })
	@MultiORMManyToOne(() => Report, (report) => report.reportOrganizations, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	report?: IReport;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((report: ReportOrganization) => report.report)
	@Column()
	reportId?: string;

	@Column({ default: true })
	isEnabled?: boolean;
}
