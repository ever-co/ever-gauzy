import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
	FeatureEnum,
	IFeature,
	IPagination
} from '@gauzy/contracts';
import { gauzyToggleFeatures } from '@gauzy/config';
import { Feature } from './feature.entity';
import { CrudService } from '../core/crud/crud.service';

@Injectable()
export class FeatureService extends CrudService<Feature> {
	constructor(
		@InjectRepository(Feature)
		public readonly featureRepository: Repository<Feature>
	) {
		super(featureRepository);
	}

	async getParentFeatures(relations: string[] = []): Promise<IPagination<IFeature>> {
		return await this.findAll({
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
		const featureFlag = await this.findOneOrFailByWhereOptions({
			code: flag
		});
		if (!featureFlag.success) {
			return !!gauzyToggleFeatures[flag];
		}

		const { record: feature } = featureFlag;
		return feature.isEnabled;
	}
}
