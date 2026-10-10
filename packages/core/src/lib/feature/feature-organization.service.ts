import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FeatureEnum, ID, IFeature, IFeatureOrganization, IFeatureOrganizationUpdateInput, ITenant } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { evictFeatureFlagEntries } from './../shared/guards/feature-flag.guard';
import { FeatureOrganization } from './feature-organization.entity';
import { FeatureService } from './feature.service';
import { TypeOrmFeatureOrganizationRepository } from './repository/type-orm-feature-organization.repository';
import { MikroOrmFeatureOrganizationRepository } from './repository/mikro-orm-feature-organization.repository';

@Injectable()
export class FeatureOrganizationService extends TenantAwareCrudService<FeatureOrganization> {
	private readonly logger = new Logger(FeatureOrganizationService.name);

	constructor(
		readonly typeOrmFeatureOrganizationRepository: TypeOrmFeatureOrganizationRepository,
		readonly mikroOrmFeatureOrganizationRepository: MikroOrmFeatureOrganizationRepository,
		@Inject(forwardRef(() => FeatureService)) private readonly _featureService: FeatureService,
		@Inject(CACHE_MANAGER) private readonly cacheManager: Cache
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
				await this.save(featureOrganization);
			} else {
				featureOrganizations.map((item: IFeatureOrganization) => {
					return new FeatureOrganization(
						Object.assign(item, {
							...entity,
							tenantId
						})
					);
				});
				await this.saveMany(featureOrganizations);
			}

			// The rows are written; the answers a guard has cached from them are not. Which scopes those
			// are is decided by the write and not by the caller's request: a toggle that names no
			// organization rewrites the row of every organization the tenant has, and a toggle that names
			// one rewrites only that row. The scopes below are the rows this call actually touched.
			const writtenScopes: Array<ID | null> = total
				? featureOrganizations.map((item: IFeatureOrganization) => item.organizationId ?? null)
				: [organizationId ?? null];

			await this.evictFeatureFlagCache(featureId, tenantId, writtenScopes, !organizationId);

			return true;
		} catch (error) {
			this.logger.error('Error while updating feature organization', error?.message);
			return false;
		}
	}

	/**
	 * Clears the cached answers one flag write has invalidated.
	 *
	 * The guard caches each flag per tenant and organization for a minute, so a switch that is written
	 * and not evicted is a switch the API keeps ignoring — the read that decides whether a route answers
	 * or refuses never reaches the rows this method just wrote. That is the whole reason this exists.
	 *
	 * Nothing here may fail the write. The rows are already committed by the time it runs, and a cache
	 * that cannot be reached is a slower answer rather than a lost one: the entry expires on its own.
	 * So a resolution failure, an unreachable cache and a feature id the catalogue does not hold are all
	 * logged and swallowed, and the caller still reports the toggle as written.
	 *
	 * @param featureId The catalogue entry that was switched.
	 * @param tenantId The tenant whose rows were written.
	 * @param writtenScopes The organization each written row belongs to, `null` for the tenant-wide row.
	 * @param tenantWide Whether the write named no organization, which is the case whose own scope the
	 * administrator is looking at and therefore also has to be cleared.
	 */
	private async evictFeatureFlagCache(
		featureId: ID,
		tenantId: ID,
		writtenScopes: Array<ID | null>,
		tenantWide: boolean
	): Promise<void> {
		try {
			// The guard caches under the code, and the write names the row.
			const feature = await this._featureService.findOneByIdString(featureId);
			const code = feature?.code as FeatureEnum;

			if (!code) {
				return;
			}

			const scopes = [...writtenScopes];

			if (tenantWide) {
				// An organization with no row of its own resolves from the tenant-wide row, so the
				// administrator's own organization is one of the answers this write changed — and the one
				// they will look at first.
				scopes.push(RequestContext.currentOrganizationId() ?? null);
			}

			const removed = await evictFeatureFlagEntries(this.cacheManager, code, tenantId, scopes);

			this.logger.debug(`Cleared ${removed} cached answer(s) for ${code}`);
		} catch (error) {
			this.logger.warn(
				`The feature toggle was written but its cached answers were not cleared: ${error?.message}`
			);
		}
	}

	/**
	 * Create/Update feature organization for relative tenants.
	 *
	 * @param tenants An array of ITenant instances.
	 * @returns A Promise resolving to an array of IFeatureOrganization.
	 */
	public async updateTenantFeatureOrganizations(tenants: ITenant[]): Promise<IFeatureOrganization[]> {
		if (!tenants || tenants.length === 0) {
			return [];
		}

		// Retrieve all available features
		const features: IFeature[] = await this._featureService.find();

		// Generate a cartesian product of features and tenants to create FeatureOrganization entities
		const featureOrganizations: IFeatureOrganization[] = features.flatMap((feature: IFeature) =>
			tenants.map(
				(tenant: ITenant) =>
					new FeatureOrganization({
						isEnabled: !!feature.isEnabled,
						tenant,
						feature
					})
			)
		);

		/**
		 * Use saveManyWithoutEnrichment to avoid TenantAwareCrudService.saveMany()
		 * which would overwrite per-entity tenantId with the current RequestContext tenantId.
		 */
		return await this.saveManyWithoutEnrichment(featureOrganizations);
	}
}
