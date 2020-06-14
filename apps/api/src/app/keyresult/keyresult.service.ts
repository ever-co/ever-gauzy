import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeyResult } from './keyresult.entity';

@Injectable()
export class KeyResultService extends CrudService<KeyResult> {
	constructor(
		@InjectRepository(KeyResult)
		private readonly keyResultRepository: Repository<KeyResult>
	) {
		super(keyResultRepository);
	}
}
