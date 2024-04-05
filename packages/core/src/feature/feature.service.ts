import { Injectable } from '@nestjs/common';
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
		readonly typeOrmFeatureRepository: TypeOrmFeatureRepository,
		readonly mikroOrmFeatureRepository: MikroOrmFeatureRepository
	) {
		super(typeOrmFeatureRepository, mikroOrmFeatureRepository);
	}

	/**
	 * Retrieves top-level features (those with no parent) from the database. Allows specifying related entities
	 * to be included in the result. Features are ordered by their creation time in ascending order.
	 *
	 * @param relations An array of strings indicating which related entities to include in the result.
	 * @returns A promise resolving to a paginated response containing top-level IFeature objects.
	 */
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
	 * Checks if the specified feature flag is enabled.
	 * @param flag The feature flag to check.
	 * @returns A boolean indicating whether the feature flag is enabled.
	 */
	public async isFeatureEnabled(flag: FeatureEnum): Promise<boolean> {
		try {
			const featureFlag = await super.findOneByWhereOptions({ code: flag });
			return featureFlag.isEnabled;
		} catch (error) {
			// Feature flag not found, fallback to default value
			return !!gauzyToggleFeatures[flag];
		}
	}
}
