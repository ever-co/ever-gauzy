import { Entity, Column, RelationId, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IOrganization, IReport, IReportOrganization } from '@gauzy/models';
import { Base } from '../core/entities/base';
import { Organization } from '../organization/organization.entity';
import { Report } from './report.entity';

@Entity('report_organization')
export class ReportOrganization extends Base implements IReportOrganization {
	@ApiProperty({ type: Report })
	@ManyToOne(() => Report)
	@JoinColumn()
	report?: IReport;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((report: ReportOrganization) => report.report)
	@Column()
	reportId?: string;

	@ApiProperty({ type: Organization })
	@ManyToOne(() => Organization)
	@JoinColumn()
	organization?: IOrganization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((report: ReportOrganization) => report.organization)
	@Column()
	organizationId?: string;

	@Column({ default: true })
	isEnabled?: boolean;
}
