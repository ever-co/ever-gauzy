import { Controller, Get, HttpStatus, Query, UseGuards, Put, Param, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IOrganizationPosition, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { OrganizationPositionService } from './organization-position.service';
import { OrganizationPosition } from './organization-position.entity';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { UpdateOrganizationPositionDTO } from './dto';

@ApiTags('OrganizationPositions')
@UseGuards(TenantPermissionGuard)
@Controller('/organization-positions')
export class OrganizationPositionController extends CrudController<OrganizationPosition> {
	constructor(private readonly organizationPositionService: OrganizationPositionService) {
		super(organizationPositionService);
	}

	/**
	 * GET organization positions recurring expense
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization positions recurring expense.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found positions recurring expense',
		type: OrganizationPosition
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IOrganizationPosition>> {
		const { relations = [], findInput } = data;
		return this.organizationPositionService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * UPDATE organization position by id
	 *
	 * @param id
	 * @param body
	 * @returns
	 */
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: UpdateOrganizationPositionDTO
	): Promise<IOrganizationPosition> {
		try {
			return this.organizationPositionService.create({
				id,
				...body
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
