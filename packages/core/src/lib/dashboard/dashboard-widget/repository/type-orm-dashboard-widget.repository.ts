import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardWidget } from '../dashboard-widget.entity';

@Injectable()
export class TypeOrmDashboardWidgetRepository extends Repository<DashboardWidget> {
	constructor(@InjectRepository(DashboardWidget) readonly repository: Repository<DashboardWidget>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
