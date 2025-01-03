import { Controller, HttpStatus, Get, Query, UseGuards, HttpCode, Delete, Param } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { parseToBoolean } from '@gauzy/common';
import { IUserOrganization, IPagination, ID } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { UserOrganizationService } from './user-organization.services';
import { UserOrganization } from './user-organization.entity';
import { UserOrganizationDeleteCommand } from './commands';
import { FindMeUserOrganizationDTO } from './dto/find-me-user-organization.dto';

@ApiTags('UserOrganization')
@UseGuards(TenantPermissionGuard)
@Controller()
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
		@Query() params: PaginationParams<UserOrganization>,
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
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<IUserOrganization> {
		return await this.commandBus.execute(new UserOrganizationDeleteCommand(id));
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
