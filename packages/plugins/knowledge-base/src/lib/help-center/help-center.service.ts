import { Injectable } from '@nestjs/common';
import { IHelpCenter, ID } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { isNotEmpty } from '@gauzy/utils';
import { HelpCenter } from './help-center.entity';
import { TypeOrmHelpCenterRepository } from './repository/type-orm-help-center.repository';
import { MikroOrmHelpCenterRepository } from './repository/mikro-orm-help-center.repository';

@Injectable()
export class HelpCenterService extends TenantAwareCrudService<HelpCenter> {
	constructor(
		typeOrmHelpCenterRepository: TypeOrmHelpCenterRepository,
		mikroOrmHelpCenterRepository: MikroOrmHelpCenterRepository
	) {
		super(typeOrmHelpCenterRepository, mikroOrmHelpCenterRepository);
	}

	async updateBulk(updateInput: IHelpCenter[]) {
		return await Promise.all(updateInput.map((item) => this.save(item)));
	}

	async deleteBulkByBaseId(ids: ID[]) {
		if (isNotEmpty(ids)) {
			return await Promise.all(ids.map((id) => this.delete(id)));
		}
	}

	async getCategoriesByBaseId(baseId: ID): Promise<HelpCenter[]> {
		return await this.find({
			where: { parentId: baseId } as any
		});
	}

	async getAllNodes(): Promise<HelpCenter[]> {
		return await this.find({});
	}
}
