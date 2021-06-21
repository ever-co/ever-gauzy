import { Entity, Column, RelationId, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IReport, IReportOrganization } from '@gauzy/contracts';
import { Report, TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('report_organization')
export class ReportOrganization extends TenantOrganizationBaseEntity implements IReportOrganization {

	@ApiProperty({ type: () => Report })
	@ManyToOne(() => Report, (report) => report.reportOrganizations, {
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
