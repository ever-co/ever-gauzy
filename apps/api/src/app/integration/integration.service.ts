import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Integration } from './integration.entity';

@Injectable()
export class IntegrationService extends CrudService<Integration> {
	constructor(
		@InjectRepository(Integration)
		readonly repository: Repository<Integration>
	) {
		super(repository);
	}
}
