import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HelpCenter } from './help-center.entity';
import { IHelpCenter } from '@gauzy/models';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';

@Injectable()
export class HelpCenterService extends TenantAwareCrudService<HelpCenter> {
	constructor(
		@InjectRepository(HelpCenter)
		private readonly HelpCenterRepository: Repository<HelpCenter>
	) {
		super(HelpCenterRepository);
	}
	async updateBulk(updateInput: IHelpCenter[]) {
		return await this.repository.save(updateInput);
	}
	async deleteBulkByBaseId(ids: string[]) {
		return await this.repository.delete(ids);
	}
	async getCategoriesByBaseId(baseId: string): Promise<HelpCenter[]> {
		return await this.repository
			.createQueryBuilder('knowledge_base')
			.where('knowledge_base.parentId = :baseId', {
				baseId
			})
			.getMany();
	}
	async getAllNodes(): Promise<HelpCenter[]> {
		return await this.repository
			.createQueryBuilder('knowledge_base')
			.getMany();
	}
}
