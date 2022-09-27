import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
	IFeature,
	IPagination
} from '@gauzy/contracts';
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
}
