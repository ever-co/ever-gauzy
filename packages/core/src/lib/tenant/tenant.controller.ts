import { ITenant, RolesEnum } from '@gauzy/contracts';
import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	HttpStatus,
	Post,
	Put,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, UpdateResult } from 'typeorm';
import { RequestContext } from '../core/context';
import { Roles } from './../shared/decorators';
import { RoleGuard } from './../shared/guards';
import { UseValidationPipe } from '../shared/pipes';
import { CreateTenantDTO, UpdateTenantDTO } from './dto';
import { TenantService } from './tenant.service';

@ApiTags('Tenant')
@Controller('/tenant')
export class TenantController {
	constructor(private readonly tenantService: TenantService) {}

	/**
	 * GET Owner Tenant
	 *
	 * @returns
	 */
	@ApiOperation({ summary: 'Find by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tenant record'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Tenant record not found'
	})
	@Get('/')
	async findById(): Promise<ITenant> {
		const tenantId = RequestContext.currentTenantId();
		return await this.tenantService.findOneByIdString(tenantId);
	}

	/**
	 * CREATE Owner Tenant
	 *
	 * @returns
	 */
	@ApiOperation({
		summary: 'Create new tenant. The user who creates the tenant is given the super admin role.',
		security: [
			{
				role: [RolesEnum.SUPER_ADMIN]
			}
		]
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/')
	// `whitelist` strips anything the DTO does not declare, which the update route below has always
	// done. Without it this route persisted whatever the body carried — and now that Tenant has a
	// `stripeCustomerId`, a caller could have pointed their new tenant at somebody else's Stripe
	// customer and then read or cancelled that customer's subscription through /billing.
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateTenantDTO): Promise<ITenant> {
		const user = RequestContext.currentUser();
		if (user.tenantId || user.roleId) {
			throw new BadRequestException('Tenant already exists');
		}
		return await this.tenantService.onboardTenant(entity, user);
	}

	/**
	 * UPDATE Owner Tenant
	 *
	 * @returns
	 */
	@ApiOperation({
		summary: 'Update existing tenant. The user who updates the tenant is given the super admin role.',
		security: [
			{
				role: [RolesEnum.SUPER_ADMIN]
			}
		]
	})
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Put('/')
	@UseValidationPipe({ whitelist: true })
	async update(@Body() entity: UpdateTenantDTO): Promise<ITenant | UpdateResult> {
		try {
			const tenantId = RequestContext.currentTenantId();
			return await this.tenantService.update(tenantId, entity);
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	/**
	 * DELETE Owner Tenant
	 *
	 * @returns
	 */
	@ApiOperation({
		summary: 'Delete tenant',
		security: [
			{
				role: [RolesEnum.SUPER_ADMIN]
			}
		]
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The tenant has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Tenant record not found'
	})
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Delete('/')
	async delete(): Promise<DeleteResult> {
		try {
			const tenantId = RequestContext.currentTenantId();
			return await this.tenantService.delete(tenantId);
		} catch (error) {
			throw new ForbiddenException();
		}
	}
}
