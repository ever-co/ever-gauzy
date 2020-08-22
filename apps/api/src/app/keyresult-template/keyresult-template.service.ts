import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { KeyResultTemplate } from './keyresult-template.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class KeyresultTemplateService extends TenantAwareCrudService<
	KeyResultTemplate
> {
	constructor(
		@InjectRepository(KeyResultTemplate)
		private readonly keyResultTemplateRepository: Repository<
			KeyResultTemplate
		>
	) {
		super(keyResultTemplateRepository);
	}
}
