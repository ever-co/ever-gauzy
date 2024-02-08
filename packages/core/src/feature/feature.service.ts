import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import {
	FeatureEnum,
	IFeature,
	IPagination
} from '@gauzy/contracts';
import { gauzyToggleFeatures } from '@gauzy/config';
import { Feature } from './feature.entity';
import { CrudService } from '../core/crud/crud.service';
import { TypeOrmFeatureRepository } from './repository/type-orm-feature.repository';
import { MikroOrmFeatureRepository } from './repository/mikro-orm-feature.repository';

@Injectable()
export class FeatureService extends CrudService<Feature> {
	constructor(
		@InjectRepository(Feature)
		typeOrmFeatureRepository: TypeOrmFeatureRepository,

		mikroOrmFeatureRepository: MikroOrmFeatureRepository
	) {
		super(typeOrmFeatureRepository, mikroOrmFeatureRepository);
	}

	async getParentFeatures(relations: string[] = []): Promise<IPagination<IFeature>> {
		return await super.findAll({
			where: {
				parentId: IsNull()
			},
			relations,
			order: {
				createdAt: 'ASC'
			}
		});
	}

	/**
	 * Feature flag enabled/disabled checked
	 *
	 * @param flag
	 * @returns
	 */
	public async isFeatureEnabled(flag: FeatureEnum) {
		const featureFlag = await super.findOneOrFailByWhereOptions({
			code: flag
		});
		if (!featureFlag.success) {
			return !!gauzyToggleFeatures[flag];
		}

		const { record: feature } = featureFlag;
		return feature.isEnabled;
	}
}
