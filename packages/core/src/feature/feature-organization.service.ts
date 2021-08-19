import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IFeature, IFeatureOrganization, IFeatureOrganizationUpdateInput, ITenant } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { FeatureOrganization } from './feature-organization.entity';
import { FeatureService } from './feature.service';

@Injectable()
export class FeatureOrganizationService extends TenantAwareCrudService<FeatureOrganization> {
	constructor(
		@InjectRepository(FeatureOrganization)
		public readonly featureOrganizationRepository: Repository<FeatureOrganization>,

		@Inject(forwardRef(() => FeatureService))
		private readonly _featureService: FeatureService
	) {
		super(featureOrganizationRepository);
	}

	/**
	 * UPDATE feature organization respective tenant by feature id
	 * 
	 * @param input 
	 * @returns 
	 */
	async updateFeatureOrganization(
		entity: IFeatureOrganizationUpdateInput
	): Promise<IFeatureOrganization[]> {

		const tenantId = RequestContext.currentTenantId();
		const { featureId, organizationId } = entity;
		
		// find all feature organization by feature id
		const { items : featureOrganizations, total } = await this.findAll({
			where: {
				tenantId,
				featureId,
				...(isNotEmpty(organizationId) ? { organizationId } : {}),
			}
		});

		if (!total) {
			const featureOrganization: IFeatureOrganization  = new FeatureOrganization({
				...entity,
				tenantId
			});
			await this.featureOrganizationRepository.save(featureOrganization);
		} else {
			featureOrganizations.map((item: IFeatureOrganization) => {
				return new FeatureOrganization(Object.assign(item, {
					...entity,
					tenantId
				}));
			});
			await this.featureOrganizationRepository.save(featureOrganizations);
		}
		return featureOrganizations;
	}

	/**
	 * Create/Update feature organization for relative tenants
	 * 
	 * @param tenants 
	 * @returns 
	 */
	public async updateTenantFeatureOrganizations(
		tenants: ITenant[]
	): Promise<IFeatureOrganization[]> {
		if (!tenants.length) {
			return;
		}
		
		const featureOrganizations: IFeatureOrganization[] = [];
		const { items } = await this._featureService.findAll();
		const features: IFeature[] = items;
		
		for await (const feature of features) {
			for await (const tenant of tenants) {
				const { isEnabled } = feature;
				const featureOrganization: IFeatureOrganization = new FeatureOrganization({
					isEnabled,
					tenant,
					feature
				});
				featureOrganizations.push(featureOrganization);
			}
		}
		return await this.featureOrganizationRepository.save(
			featureOrganizations
		);
	}
}
