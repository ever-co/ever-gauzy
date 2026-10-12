import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, UpdateResult } from 'typeorm';
import { ID, IOfficialHoliday, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateOfficialHolidayDTO, OfficialHolidayQueryDTO, UpdateOfficialHolidayDTO } from './dto';
import { OfficialHolidayService } from './official-holiday.service';

/**
 * Official holidays per country (issue #314).
 *
 * Reuses the Time Off policy permissions: an official holiday list is organization-level Time Off
 * configuration, managed by the same people who manage the policies.
 */
@ApiTags('OfficialHoliday')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_EDIT)
@Controller('/official-holiday')
export class OfficialHolidayController {
	constructor(private readonly officialHolidayService: OfficialHolidayService) {}

	/**
	 * List the official holidays of an organization, optionally by country and year.
	 *
	 * @param options the country code and/or calendar year to filter by
	 * @returns the matching holidays, earliest first
	 */
	@ApiOperation({ summary: 'Find official holidays' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found official holidays' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_POLICY_VIEW)
	@Get('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() options: OfficialHolidayQueryDTO): Promise<IPagination<IOfficialHoliday>> {
		return this.officialHolidayService.findAllByFilter(options);
	}

	/**
	 * Get one official holiday by id.
	 *
	 * @param id the holiday to read
	 * @returns the holiday
	 */
	@ApiOperation({ summary: 'Find an official holiday by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found the holiday' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_POLICY_VIEW)
	@Get('/:id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IOfficialHoliday> {
		return this.officialHolidayService.findOneByIdString(id);
	}

	/**
	 * Create an official holiday.
	 *
	 * @param entity the holiday to create
	 * @returns the created holiday
	 */
	@ApiOperation({ summary: 'Create an official holiday' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The holiday has been created.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input, check the response body for details' })
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_ADD)
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOfficialHolidayDTO): Promise<IOfficialHoliday> {
		return this.officialHolidayService.create(entity);
	}

	/**
	 * Update an official holiday.
	 *
	 * @param id the holiday to update
	 * @param entity the fields to change
	 * @returns the updated holiday
	 */
	@ApiOperation({ summary: 'Update an official holiday' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The holiday has been updated.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_EDIT)
	@Put('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOfficialHolidayDTO
	): Promise<IOfficialHoliday | UpdateResult> {
		return this.officialHolidayService.update(id, entity);
	}

	/**
	 * Delete an official holiday.
	 *
	 * @param id the holiday to delete
	 * @returns the delete result
	 */
	@ApiOperation({ summary: 'Delete an official holiday' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'The holiday has been deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.NO_CONTENT)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_DELETE)
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return this.officialHolidayService.delete(id);
	}
}
