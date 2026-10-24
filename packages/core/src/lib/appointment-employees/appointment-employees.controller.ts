import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CrudController } from './../core/crud';
import { TenantOrganizationBaseDTO } from './../core/dto';
import { AppointmentEmployee } from './appointment-employees.entity';
import { AppointmentEmployeesService } from './appointment-employees.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Controller,
	UseGuards,
	HttpStatus,
	Get,
	Param,
	Body,
	Post,
	Put,
	Delete,
	HttpCode,
	UsePipes
} from '@nestjs/common';
import { IAppointmentEmployee, ID, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../shared/decorators';
import { AbstractValidationPipe, UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';

@ApiTags('AppointmentEmployee')
@UseGuards(TenantPermissionGuard)
@Controller('/appointment-employees')
export class AppointmentEmployeesController extends CrudController<AppointmentEmployee> {
	constructor(private readonly appointmentEmployeesService: AppointmentEmployeesService) {
		super(appointmentEmployeesService);
	}

	@ApiOperation({ summary: 'Find appointment employees by appointment id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: AppointmentEmployee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('appointment/:appointmentId')
	async findByAppointmentId(
		@Param('appointmentId', UUIDValidationPipe) appointmentId: string
	): Promise<IAppointmentEmployee[]> {
		return (
			await this.appointmentEmployeesService.findAll({
				where: {
					appointmentId
				}
			})
		).items;
	}

	@ApiOperation({ summary: 'Find appointments based on employee id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records',
		type: AppointmentEmployee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Get('employee-appointments/:employeeId')
	async findEmployeeAppointments(
		@Param('employeeId', UUIDValidationPipe) employeeId: string
	): Promise<IAppointmentEmployee[]> {
		return (
			await this.appointmentEmployeesService.findAll({
				where: {
					employeeId: employeeId
				},
				relations: ['employeeAppointment']
			})
		).items;
	}

	/**
	 * CREATE appointment employee
	 *
	 * Overrides the inherited `CrudController.create()` route only to attach the permission gate:
	 * `PermissionGuard` authorizes any route that carries no `@Permissions` metadata, so an inherited handler is
	 * reachable by every member of the tenant until it is gated here (GHSA-v79w-54p2-wmh5).
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE)
	@Post()
	async create(@Body() entity: DeepPartial<AppointmentEmployee>): Promise<AppointmentEmployee> {
		return super.create(entity);
	}

	/**
	 * UPDATE appointment employee by id
	 *
	 * Overrides the inherited `CrudController.update()` route only to attach the permission gate; the base still
	 * drops the members a body never writes (the id, the tenant and `deletedAt`).
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update existing record' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The record has been successfully updated.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<AppointmentEmployee>
	): Promise<any> {
		return super.update(id, entity);
	}

	/**
	 * DELETE appointment employee by id
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach the permission gate:
	 * `PermissionGuard` authorizes any route that carries no `@Permissions` metadata, so an inherited handler is
	 * reachable by every member of the tenant until it is gated here (GHSA-v79w-54p2-wmh5).
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The record has been successfully deleted'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return super.delete(id);
	}

	/**
	 * SOFT DELETE appointment employee by id
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach the permission gate: the edit grant
	 * `update` states, as owner decision 5 (2026-10-13) has the soft-delete/recover pair require.
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Record soft deleted successfully'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<AppointmentEmployee> {
		return super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted appointment employee by id
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach the permission gate: the edit grant
	 * `update` states, as owner decision 5 (2026-10-13) has the soft-delete/recover pair require.
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Record restored successfully'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<AppointmentEmployee> {
		return super.softRecover(id, ...options);
	}
}
