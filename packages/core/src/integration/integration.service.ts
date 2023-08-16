import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud';
import { Integration } from './integration.entity';

@Injectable()
export class IntegrationService extends CrudService<Integration> {
	constructor(
		@InjectRepository(Integration)
		readonly repository: Repository<Integration>,
	) {
		super(repository);
	}
}
