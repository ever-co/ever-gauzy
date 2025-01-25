import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { IFeature, IFeatureOrganization, IFeatureOrganizationUpdateInput, ITenant } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { FeatureOrganization } from './feature-organization.entity';
import { FeatureService } from './feature.service';
import { TypeOrmFeatureOrganizationRepository } from './repository/type-orm-feature-organization.repository';
import { MikroOrmFeatureOrganizationRepository } from './repository/mikro-orm-feature-organization.repository';

@Injectable()
export class FeatureOrganizationService extends TenantAwareCrudService<FeatureOrganization> {
	constructor(
		readonly typeOrmFeatureOrganizationRepository: TypeOrmFeatureOrganizationRepository,

		readonly mikroOrmFeatureOrganizationRepository: MikroOrmFeatureOrganizationRepository,

		@Inject(forwardRef(() => FeatureService))
		private readonly _featureService: FeatureService
	) {
		super(typeOrmFeatureOrganizationRepository, mikroOrmFeatureOrganizationRepository);
	}

	/**
	 * UPDATE feature organization respective tenant by feature id
	 *
	 * @param input
	 * @returns
	 */
	async updateFeatureOrganization(entity: IFeatureOrganizationUpdateInput): Promise<boolean> {
		const tenantId = RequestContext.currentTenantId();
		const { featureId, organizationId } = entity;

		// find all feature organization by feature id
		const { items: featureOrganizations, total } = await this.findAll({
			where: {
				tenantId,
				featureId,
				...(isNotEmpty(organizationId) ? { organizationId } : {})
			}
		});

		try {
			if (!total) {
				const featureOrganization: IFeatureOrganization = new FeatureOrganization({
					...entity,
					tenantId
				});
				await this.typeOrmRepository.save(featureOrganization);
			} else {
				featureOrganizations.map((item: IFeatureOrganization) => {
					return new FeatureOrganization(
						Object.assign(item, {
							...entity,
							tenantId
						})
					);
				});
				await this.typeOrmRepository.save(featureOrganizations);
			}
			return true;
		} catch (error) {
			console.log('Error while updating feature organization', error);
			return false;
		}
	}

	/**
	 * Create/Update feature organization for relative tenants.
	 *
	 * @param tenants An array of ITenant instances.
	 * @returns A Promise resolving to an array of IFeatureOrganization.
	 */
	public async updateTenantFeatureOrganizations(tenants: ITenant[]): Promise<IFeatureOrganization[]> {
		if (!tenants.length) {
			return [];
		}

		const featureOrganizations: IFeatureOrganization[] = [];
		const features: IFeature[] = await this._featureService.find();

		for (const feature of features) {
			const isEnabled = feature.isEnabled;
			const tenantFeatureOrganizations = tenants.map(
				(tenant) =>
					new FeatureOrganization({
						isEnabled,
						tenant,
						feature
					})
			);

			featureOrganizations.push(...tenantFeatureOrganizations);
		}

		return await this.typeOrmRepository.save(featureOrganizations);
	}
}
