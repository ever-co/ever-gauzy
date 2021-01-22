import { Entity, Column, RelationId, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	DeepPartial,
	IOrganization,
	IReport,
	IReportOrganization
} from '@gauzy/common';
import { BaseEntity, Organization, Report } from '../internal';
@Entity('report_organization')
export class ReportOrganization
	extends BaseEntity
	implements IReportOrganization {
	constructor(input?: DeepPartial<ReportOrganization>) {
		super(input);
	}

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
