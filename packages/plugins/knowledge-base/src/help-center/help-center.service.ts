import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IHelpCenter } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { isNotEmpty } from '@gauzy/common';
import { HelpCenter } from './help-center.entity';

@Injectable()
export class HelpCenterService extends TenantAwareCrudService<HelpCenter> {
	constructor(
		@InjectRepository(HelpCenter)
		private readonly helpCenterRepository: Repository<HelpCenter>
	) {
		super(helpCenterRepository);
	}

	async updateBulk(updateInput: IHelpCenter[]) {
		return await this.repository.save(updateInput);
	}

	async deleteBulkByBaseId(ids: string[]) {
		if (isNotEmpty(ids)) {
			return await this.repository.delete(ids);
		}
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
