import { RelationId, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IReport, IReportOrganization } from '@gauzy/contracts';
import { Report, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmReportOrganizationRepository } from './repository/mikro-orm-report-organization.repository';

@MultiORMEntity('report_organization', { mikroOrmRepository: () => MikroOrmReportOrganizationRepository })
export class ReportOrganization extends TenantOrganizationBaseEntity implements IReportOrganization {

	@MultiORMColumn({ default: true })
	isEnabled?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	@MultiORMManyToOne(() => Report, (it) => it.reportOrganizations, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	report?: IReport;

	@ApiProperty({ type: () => String })
	@RelationId((it: ReportOrganization) => it.report)
	@MultiORMColumn({ relationId: true })
	reportId?: IReport['id'];
}
