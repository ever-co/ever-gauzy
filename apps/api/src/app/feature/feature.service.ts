import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { Feature } from './feature.entity';
import { IFeature, IFeatureOrganization, IPagination } from '@gauzy/models';
import { FeatureOrganization } from './feature_organization.entity';

@Injectable()
export class FeatureService extends TenantAwareCrudService<Feature> {
	constructor(
		@InjectRepository(Feature)
		public readonly featureRepository: Repository<Feature>,

		@InjectRepository(FeatureOrganization)
		public readonly featureOrganizationRepository: Repository<FeatureOrganization>
	) {
		super(featureRepository);
	}

	async getAll(request: any): Promise<IPagination<IFeature>> {
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

	async getFeatureOrganizations(
		tenantId: string
	): Promise<IFeatureOrganization[]> {
		return await this.featureOrganizationRepository.find({
			where: {
				tenantId
			}
		});
	}
}
