import {
	Body,
	Controller,
	HttpStatus,
	Get,
	Post,
	Put,
	Query,
	UseGuards,
	HttpCode,
	Delete,
	Param,
	UseInterceptors
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { parseToBoolean } from '@gauzy/utils';
import { IUserOrganization, IPagination, ID, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { UUIDValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UserOrganizationService } from './user-organization.services';
import { UserOrganization } from './user-organization.entity';
import { UserOrganizationDeleteCommand } from './commands';
import { FindMeUserOrganizationDTO } from './dto/find-me-user-organization.dto';
import { SensitiveRelations } from '../core/decorators/sensitive-relations.decorator';
import { SensitiveRelationsInterceptor } from '../core/interceptors/sensitive-relations.interceptor';
import { ORGANIZATION_SENSITIVE_RELATIONS } from '../core/util/organization-sensitive-relations.config';

@ApiTags('UserOrganization')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@UseInterceptors(SensitiveRelationsInterceptor)
@SensitiveRelations(ORGANIZATION_SENSITIVE_RELATIONS, 'organization')
@Controller('/user-organization')
export class UserOrganizationController extends CrudController<UserOrganization> {
	constructor(
		private readonly userOrganizationService: UserOrganizationService,
		private readonly commandBus: CommandBus
	) {
		super(userOrganizationService);
	}

	/**
	 * Find all UserOrganizations.
	 *
	 * @param params - The pagination parameters.
	 * @param query - Additional query parameters to filter results.
	 * @returns A paginated list of UserOrganizations.
	 */
	@ApiOperation({ summary: 'Find all UserOrganizations.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found UserOrganizations'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query() params: BaseQueryDTO<UserOrganization>,
		@Query() query: FindMeUserOrganizationDTO
	): Promise<IPagination<IUserOrganization>> {
		return await this.userOrganizationService.findUserOrganizations(params, parseToBoolean(query.includeEmployee));
	}

	/**
	 * Delete user from organization.
	 *
	 * @param id - The ID of the user organization to delete.
	 * @param user - The user making the request.
	 * @param language - The language to use for any error messages or responses.
	 * @returns The deleted user organization.
	 */
	@ApiOperation({ summary: 'Delete user from organization' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The user has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ORG_USERS_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<IUserOrganization> {
		return await this.commandBus.execute(new UserOrganizationDeleteCommand(id));
	}

	/**
	 * Add a user to an organization.
	 *
	 * Declared here only so the inherited `CrudController` route carries a permission. Without an
	 * override there is no handler on this class for the decorator to sit on, and `PermissionGuard`
	 * authorizes any route whose permission metadata is empty.
	 *
	 * @param entity - The membership to create.
	 * @returns The created membership.
	 */
	@ApiOperation({ summary: 'Add a user to an organization' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The membership has been created' })
	@Permissions(PermissionsEnum.ORG_USERS_EDIT)
	@Post()
	async create(@Body() entity: DeepPartial<UserOrganization>): Promise<UserOrganization> {
		return await super.create(entity);
	}

	/**
	 * Update a user's membership of an organization.
	 *
	 * Declared here only so the inherited `CrudController` route carries a permission. See
	 * {@link create} for why an override is required.
	 *
	 * @param id - The membership to update.
	 * @param entity - The fields to update.
	 * @returns The updated membership.
	 */
	@ApiOperation({ summary: "Update a user's membership of an organization" })
	@ApiResponse({ status: HttpStatus.OK, description: 'The membership has been updated' })
	@Permissions(PermissionsEnum.ORG_USERS_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<UserOrganization>
	): Promise<any> {
		return await super.update(id, entity);
	}

	/**
	 * Soft-delete a user's membership of an organization.
	 *
	 * Declared here only so the inherited `CrudController` route carries a permission. See
	 * {@link create} for why an override is required.
	 *
	 * @param id - The membership to soft-delete.
	 * @returns The soft-deleted membership.
	 */
	@ApiOperation({ summary: "Soft-delete a user's membership of an organization" })
	@ApiResponse({ status: HttpStatus.OK, description: 'The membership has been soft-deleted' })
	@Permissions(PermissionsEnum.ORG_USERS_EDIT)
	@Delete(':id/soft')
	async softRemove(@Param('id', UUIDValidationPipe) id: ID): Promise<UserOrganization> {
		return await super.softRemove(id);
	}

	/**
	 * Restore a soft-deleted membership of an organization.
	 *
	 * Declared here only so the inherited `CrudController` route carries a permission. See
	 * {@link create} for why an override is required.
	 *
	 * @param id - The membership to restore.
	 * @returns The restored membership.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted membership of an organization' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The membership has been restored' })
	@Permissions(PermissionsEnum.ORG_USERS_EDIT)
	@Put(':id/recover')
	async softRecover(@Param('id', UUIDValidationPipe) id: ID): Promise<UserOrganization> {
		return await super.softRecover(id);
	}

	/**
	 * Find the number of organizations a user belongs to.
	 *
	 * @param id - The user ID.
	 * @returns The count of organizations the user belongs to.
	 */
	@ApiOperation({ summary: 'Find number of Organizations user belongs to' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Count of Organizations given user belongs to',
		type: Number
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id/count')
	async findOrganizationCount(@Param('id', UUIDValidationPipe) id: ID): Promise<number> {
		try {
			// Retrieve the user organization by ID
			const user = await this.userOrganizationService.findOneByIdString(id);

			// Extract user ID from the retrieved user organization
			const { userId } = user;

			// Attempt to count the user organizations
			const total = await this.userOrganizationService.count({
				where: { userId, isActive: true, isArchived: false }
			});

			// Return the total count of user organizations
			return total;
		} catch (error) {
			console.error('Error retrieving user organization count:', error.message);
			throw new Error('Failed to retrieve user organization count.');
		}
	}
}
