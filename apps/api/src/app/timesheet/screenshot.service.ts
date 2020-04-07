import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Screenshot } from './screenshot.entity';

@Injectable()
export class ScreenShotService extends CrudService<Screenshot> {
	constructor(
		@InjectRepository(Screenshot)
		private readonly screenShotRepository: Repository<Screenshot>
	) {
		super(screenShotRepository);
	}
}
