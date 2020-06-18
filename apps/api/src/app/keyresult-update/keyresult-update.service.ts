import { Injectable } from '@nestjs/common';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeyResultUpdates } from '@gauzy/models';
import { KeyResultUpdate } from './keyresult-update.entity';

@Injectable()
export class KeyResultUpdateService extends CrudService<KeyResultUpdates> {
	constructor(
		@InjectRepository(KeyResultUpdate)
		private readonly keyResultUpdateRepository: Repository<KeyResultUpdates>
	) {
		super(keyResultUpdateRepository);
	}
}
