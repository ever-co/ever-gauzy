import { Injectable } from '@nestjs/common';
import { In, FindOptionsWhere, DeleteResult } from 'typeorm';
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
		return await this.saveMany(updateInput);
	}

	async deleteBulkByBaseId(ids: ID[]): Promise<DeleteResult[]> {
		if (isNotEmpty(ids)) {
			/**
			 * TypeORM typing limitations: cast via unknown to FindOptionsWhere.
			 * TenantAwareCrudService.delete() enforces tenant scoping so tenant safety is preserved.
			 */
			return [await this.delete({ id: In(ids) } as unknown as FindOptionsWhere<HelpCenter>)];
		}
		return [];
	}

	async getCategoriesByBaseId(baseId: ID): Promise<HelpCenter[]> {
		return await this.find({
			where: { parentId: baseId } as FindOptionsWhere<HelpCenter>
		});
	}

	async getAllNodes(): Promise<HelpCenter[]> {
		return await this.find({});
	}
}
