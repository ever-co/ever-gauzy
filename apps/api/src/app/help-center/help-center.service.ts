import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { HelpCenter } from './help-center.entity';

@Injectable()
export class HelpCenterService extends CrudService<HelpCenter> {
	constructor(
		@InjectRepository(HelpCenter)
		private readonly HelpCenterRepository: Repository<HelpCenter>
	) {
		super(HelpCenterRepository);
	}
}
