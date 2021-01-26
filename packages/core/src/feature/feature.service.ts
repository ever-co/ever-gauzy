import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Feature } from './feature.entity';
import { CrudService } from '../core/crud/crud.service';
import {
	IFeature,
	IFeatureOrganization,
	IFeatureOrganizationUpdateInput,
	IPagination,
	ITenant
} from '@gauzy/contracts';
import { FeatureOrganization } from './feature_organization.entity';

@Injectable()
export class FeatureService extends CrudService<Feature> {
	constructor(
		@InjectRepository(Feature)
		public readonly featureRepository: Repository<Feature>,

		@InjectRepository(FeatureOrganization)
		public readonly featureOrganizationRepository: Repository<FeatureOrganization>
	) {
		super(featureRepository);
	}

	async getParentFeatureList(request: any): Promise<IPagination<IFeature>> {
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

	async getAllFeatureList(): Promise<IPagination<IFeature>> {
		return await this.findAll({
			order: {
				createdAt: 'ASC'
			}
		});
	}

	async getFeatureOrganizations(data: any): Promise<IFeatureOrganization[]> {
		const { relations = [], findInput = {} } = data;
		return await this.featureOrganizationRepository.find({
			where: findInput,
			relations
		});
	}

	async updateFeatureOrganization(
		input: IFeatureOrganizationUpdateInput
	): Promise<IFeatureOrganization[]> {
		const { featureId, tenantId, organizationId } = input;
		const where = {
			featureId,
			tenantId
		};

		if (organizationId) {
			where['organizationId'] = organizationId;
		}

		const featureOrganizations = await this.featureOrganizationRepository.find(
			{
				where
			}
		);
		if (!featureOrganizations.length) {
			const featureOrganization = new FeatureOrganization(input);
			await this.featureOrganizationRepository.save(featureOrganization);
		} else {
			featureOrganizations.map((item: FeatureOrganization) => {
				return new FeatureOrganization(Object.assign(item, input));
			});
			await this.featureOrganizationRepository.save(featureOrganizations);
		}
		return featureOrganizations;
	}

	/*
	 * Create/Update feature organization for relative tenants
	 */
	public async updateTenantFeatureOrganizations(
		tenants: ITenant[]
	): Promise<IFeatureOrganization[]> {
		if (!tenants.length) {
			return;
		}
		const features: IFeature[] = await this.featureRepository.find();

		const featureOrganizations: IFeatureOrganization[] = [];
		features.forEach(async (feature: IFeature) => {
			tenants.forEach((tenant: ITenant) => {
				const { isEnabled } = feature;
				const featureOrganization: IFeatureOrganization = new FeatureOrganization(
					{
						isEnabled,
						tenant,
						feature
					}
				);
				featureOrganizations.push(featureOrganization);
			});
		});

		return await this.featureOrganizationRepository.save(
			featureOrganizations
		);
	}
}
