import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Feature } from './feature.entity';
import { CrudService } from '../core/crud/crud.service';
import {
	IFeature,
	IPagination
} from '@gauzy/contracts';

@Injectable()
export class FeatureService extends CrudService<Feature> {
	constructor(
		@InjectRepository(Feature)
		public readonly featureRepository: Repository<Feature>
	) {
		super(featureRepository);
	}

	async getParentFeatures(request: any): Promise<IPagination<IFeature>> {
		const { relations = [] } = request;
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
