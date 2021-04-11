import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from '../../core/crud/tenant-aware-crud.service';
import { Screenshot } from './screenshot.entity';

@Injectable()
export class ScreenshotService extends TenantAwareCrudService<Screenshot> {
	constructor(
		@InjectRepository(Screenshot)
		private readonly screenShotRepository: Repository<Screenshot>
	) {
		super(screenShotRepository);
	}
}
