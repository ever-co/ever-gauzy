import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { Feature } from './feature.entity';
import { IFeature, IPagination } from '@gauzy/models';

@Injectable()
export class FeatureService extends TenantAwareCrudService<Feature> {
	constructor(
		@InjectRepository(Feature)
		public readonly featureRepository: Repository<Feature>
	) {
		super(featureRepository);
	}

	async getAll(): Promise<IPagination<IFeature>> {
		return await this.findAll();
	}
}
