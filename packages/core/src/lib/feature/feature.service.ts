import { Injectable, Logger } from '@nestjs/common';
import { FindOptionsWhere, IsNull } from 'typeorm';
import { FeatureEnum, ID, IFeature, IPagination } from '@gauzy/contracts';
import { gauzyToggleFeatures } from '@gauzy/config';
import { Feature } from './feature.entity';
import { FeatureOrganization } from './feature-organization.entity';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context';
import { MultiORMEnum, parseTypeORMFindToMikroOrm } from '../core/utils';
import { TypeOrmFeatureRepository } from './repository/type-orm-feature.repository';
import { MikroOrmFeatureRepository } from './repository/mikro-orm-feature.repository';
import { TypeOrmFeatureOrganizationRepository } from './repository/type-orm-feature-organization.repository';
import { MikroOrmFeatureOrganizationRepository } from './repository/mikro-orm-feature-organization.repository';

/** The tenant and organization an answer is being resolved for. Either may be absent. */
interface IFeatureToggleScope {
	tenantId: ID | null;
	organizationId: ID | null;
}

@Injectable()
export class FeatureService extends CrudService<Feature> {
	private readonly logger = new Logger(FeatureService.name);

	constructor(
		readonly typeOrmFeatureRepository: TypeOrmFeatureRepository,
		readonly mikroOrmFeatureRepository: MikroOrmFeatureRepository,
		readonly typeOrmFeatureOrganizationRepository: TypeOrmFeatureOrganizationRepository,
		readonly mikroOrmFeatureOrganizationRepository: MikroOrmFeatureOrganizationRepository
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
	 * Checks if the specified feature flag is enabled for the caller's scope.
	 *
	 * **Enablement is stored per tenant, not on the catalogue entry.** A `feature` row is the catalogue
	 * entry for a code — its name, description and where the administrator is taken — and it is the same
	 * row for every tenant. Whether the code is *on* is a row of `feature_organization`, one per tenant,
	 * which is what the toggle surface (`POST /feature/toggle`) writes. `Feature.isEnabled` is a virtual
	 * field: nothing persists it, so it can never carry what an administrator switched.
	 *
	 * The answer is resolved from the stored toggles, most specific first:
	 *
	 * 1. **the organization's own toggle**, when the caller is acting inside an organization — the
	 *    toggle input accepts an `organizationId` for exactly this;
	 * 2. **the tenant-wide toggle** (`organizationId` null), which is the row a toggle written without an
	 *    organization produces and the row a tenant provisioned from scratch is given;
	 * 3. **nothing has answered**, so the deployment's own configured toggle for the code decides.
	 *
	 * The method never raises. It runs from guards on routes that carry no request context, and a
	 * resolution there has to produce a stable answer: with no tenant to scope by, and for a code the
	 * catalogue does not hold at all, the configured toggle is that answer.
	 *
	 * @param flag The feature code to resolve.
	 * @returns Whether the code is enabled for the caller's scope.
	 */
	public async isFeatureEnabled(flag: FeatureEnum): Promise<boolean> {
		try {
			const { tenantId, organizationId } = this.featureToggleScope();

			// Nothing to scope the stored toggles by, so none of them can answer: the configured toggle
			// is the only answer that is the same for every scope.
			if (!tenantId) {
				return this.configuredFeatureState(flag);
			}

			// The catalogue entry, read for its id: the toggles hang off it. A code with no catalogue
			// row has no toggles either, and the configured answer stands.
			const featureFlag = await super.findOneByWhereOptions({ code: flag });
			const toggles = await this.findFeatureToggles(featureFlag.id, tenantId);

			const scoped =
				(organizationId ? toggles.find((toggle) => toggle.organizationId === organizationId) : undefined) ??
				toggles.find((toggle) => !toggle.organizationId);

			return scoped ? scoped.isEnabled === true : this.configuredFeatureState(flag);
		} catch (error) {
			// No catalogue row for the code, or the catalogue could not be read: fall back to the default
			// value rather than raising, which is what this method has always promised its callers.
			this.logger.debug(`Falling back to the configured state of ${flag}: ${(error as Error)?.message}`);
			return this.configuredFeatureState(flag);
		}
	}

	/**
	 * The tenant and organization the caller is acting in.
	 *
	 * Read defensively: this runs on routes and jobs that carry no request context, and a resolution
	 * there must still produce a usable scope rather than throw.
	 *
	 * @returns The two ids, either of which may be absent.
	 */
	private featureToggleScope(): IFeatureToggleScope {
		try {
			return {
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			};
		} catch {
			return { tenantId: null, organizationId: null };
		}
	}

	/**
	 * The deployment's own answer for a code nothing has stored a toggle for.
	 *
	 * @param flag The feature code.
	 * @returns The configured value, `false` when the deployment's configuration does not name the code.
	 */
	private configuredFeatureState(flag: FeatureEnum): boolean {
		return !!gauzyToggleFeatures[flag];
	}

	/**
	 * The toggle rows stored for one catalogue entry and one tenant, at either scope.
	 *
	 * Filtered and read directly rather than loaded through the catalogue entry's `featureOrganizations`
	 * relation: a catalogue entry is shared by every tenant, so that relation holds one row per tenant and
	 * resolving a single flag through it would read the whole installation's toggles to answer one row.
	 *
	 * @param featureId The catalogue entry the toggles belong to.
	 * @param tenantId The tenant whose toggles are being read.
	 * @returns The tenant's toggle rows for that entry, at tenant and organization scope alike.
	 */
	private async findFeatureToggles(featureId: ID, tenantId: ID): Promise<FeatureOrganization[]> {
		const where: FindOptionsWhere<FeatureOrganization> = { tenantId, featureId };

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where: mikroWhere, mikroOptions } = parseTypeORMFindToMikroOrm<FeatureOrganization>({
					where
				});
				return (await this.mikroOrmFeatureOrganizationRepository.find(
					mikroWhere,
					mikroOptions
				)) as unknown as FeatureOrganization[];
			}
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmFeatureOrganizationRepository.find({ where });
		}
	}
}
