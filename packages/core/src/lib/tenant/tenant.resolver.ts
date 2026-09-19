import { BadRequestException, NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, ITenantCreateInput, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { Roles } from '../shared/decorators';
import { FeatureFlagGuard, RoleGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';

/** The members `CreateTenantInput` declares in the schema. */
export interface ICreateTenantInput {
	name: string;
	logo?: string;
	imageId?: Id;
	isImporting?: boolean;
	sourceId?: string;
	userSourceId?: string;
}

/** The members `UpdateTenantInput` declares in the schema. */
export interface IUpdateTenantInput {
	name: string;
	logo?: string;
	imageId?: Id;
}

/**
 * The tenant over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `TenantService` method the `/api/tenant` route reaches,
 * with the same payload.
 *
 * **The guard chain is the controller's, and the tenant is the resource that proves why that has to be
 * read rather than assumed.** `TenantController` carries no guard and no permission on the class, and
 * none of its four handlers states one: `GET /` and `POST /` are open to any authenticated caller,
 * while `PUT /` and `DELETE /` are guarded by `RoleGuard` and state the installation owner's role. So
 * the class here carries the gate and nothing else, and the two fields whose routes are role-guarded
 * state `RoleGuard` and the same role on themselves. A class-level permission added for symmetry would
 * be a scope no route of this resource has, and a field that omitted the role would serve a caller the
 * route refuses.
 *
 * **The creation refusal is the handler's, and it is restated here because it is not a guard.**
 * `POST /` refuses a caller that already belongs to a tenant or already holds a role — the platform
 * onboards one tenant per installation — and it does so inside the handler rather than through a
 * decorator, so a resolver that only mirrored the guards would let a second creation through. The
 * field performs the same check against the same request context.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability, and appended to the guard chain the routes already carry rather than replacing any part
 * of it.
 */
@Resolver('Tenant')
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class TenantResolver {
	constructor(private readonly tenantService: TenantService) {}

	/**
	 * The tenant of the caller.
	 *
	 * The read is the delivered route's own: the identifier is read from the credential, never from an
	 * argument, so a caller cannot ask for somebody else's tenant. A caller that has no tenant — one
	 * that has not been onboarded yet — is answered `null`, which is this protocol's way of stating the
	 * miss the REST route answers with a `404`.
	 */
	@Query('tenant')
	async tenant(): Promise<Tenant | null> {
		try {
			return await this.tenantService.findOneByIdString(RequestContext.currentTenantId());
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * Files a tenant and onboards the caller into it.
	 *
	 * The service is the one the delivered route calls, with the same two arguments: the stated body
	 * and the caller, which the read below takes from the same request context the route reads it from.
	 * The refusal is the route's own and is stated before the write rather than after it, because the
	 * write it guards is the one that mints a tenant.
	 */
	@Mutation('createTenant')
	async createTenant(@Args('input') input: ICreateTenantInput): Promise<Tenant> {
		const user = RequestContext.currentUser();

		// The delivered handler's own check, in the delivered handler's own order: a caller that
		// already has a tenant, or already holds a role in one, cannot create another.
		if (user?.tenantId || user?.roleId) {
			throw new BadRequestException('Tenant already exists');
		}

		return await this.tenantService.onboardTenant(input as unknown as ITenantCreateInput, user);
	}

	/**
	 * Replaces the caller's own tenant.
	 *
	 * The delivered edit takes no identifier — it edits the tenant of the credential — so the field
	 * takes none either, and the write travels to the same service method with the same body.
	 *
	 * The answer is the row read back rather than the write's own result, which is what the delivered
	 * route answers with: that result is `{ affected }`, a statement about the write, and it is not the
	 * tenant a client reads next. The read-back is performed through the same service the edit used, so
	 * the answer is the row as it now stands.
	 */
	@Mutation('updateTenant')
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	async updateTenant(@Args('input') input: IUpdateTenantInput): Promise<Tenant> {
		const tenantId = RequestContext.currentTenantId();

		await this.tenantService.update(tenantId, input as unknown as Partial<Tenant>);

		return await this.tenantService.findOneByIdString(tenantId);
	}

	/**
	 * Removes the caller's own tenant outright.
	 *
	 * The same service method the delivered removal calls, with the identifier read from the credential
	 * as that route reads it. The delivered route answers with the store's deletion result; the field
	 * answers the fact of the removal, which is the one member of that result a caller reads.
	 */
	@Mutation('deleteTenant')
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	async deleteTenant(): Promise<boolean> {
		await this.tenantService.delete(RequestContext.currentTenantId());

		return true;
	}
}
