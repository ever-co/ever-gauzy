import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ISMTPConfig } from '@gauzy/common';
import { ICustomSmtp, ID, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from './../shared/decorators';
import { AbstractValidationPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpService } from './custom-smtp.service';
import { CustomSmtpCreateCommand, CustomSmtpUpdateCommand } from './commands';
import { CrudController } from './../core/crud';
import { TenantOrganizationBaseDTO } from './../core/dto';
import { CreateCustomSmtpDTO, CustomSmtpQueryDTO, UpdateCustomSmtpDTO, ValidateCustomSmtpDTO } from './dto';

/**
 * The tenant's and the organizations' SMTP configuration, over REST.
 *
 * **Two grants.** The class states `CUSTOM_SMTP_VIEW`, which every read and the validator run under (the validator
 * stores nothing: it asks a transport whether it accepts a configuration). Every write — the creation, the edit,
 * the removal and the soft-delete/recover pair — states `CUSTOM_SMTP_EDIT`. Until 2026-10-13 the family had only
 * the read grant and every route ran under it, so the soft-delete/recover pair could not be given "the
 * controller's own edit grant" (owner decision 5): there was none. `CUSTOM_SMTP_EDIT` is granted by default to
 * the roles that hold the read grant, and `GrantCustomSmtpEditPermission1791000000573` grants it, in existing
 * tenants, to every role that holds the read grant today — so nobody who could save these settings loses it.
 */
@ApiTags('CustomSmtp')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CUSTOM_SMTP_VIEW)
@Controller('/smtp')
export class CustomSmtpController extends CrudController<CustomSmtp> {
	constructor(private readonly _customSmtpService: CustomSmtpService, private readonly _commandBus: CommandBus) {
		super(_customSmtpService);
	}

	/**
	 * GET smtp setting for tenant
	 *
	 * @param query
	 * @returns
	 */
	@ApiOperation({ summary: 'Find smtp setting for tenant.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tenant setting',
		type: CustomSmtp
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('setting')
	@UseValidationPipe({ whitelist: true })
	async getSmtpSetting(@Query() query: CustomSmtpQueryDTO): Promise<ICustomSmtp | ISMTPConfig> {
		return await this._customSmtpService.getSmtpSetting(query);
	}

	/**
	 * CREATE verify smtp transporter
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Validate new record' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('validate')
	@UseValidationPipe({ whitelist: true })
	async validateSmtpSetting(@Body() entity: ValidateCustomSmtpDTO): Promise<boolean> {
		return await this._customSmtpService.verifyTransporter(entity);
	}

	/**
	 * CREATE custom smtp for tenant/organization
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.CUSTOM_SMTP_EDIT)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateCustomSmtpDTO): Promise<ICustomSmtp> {
		return await this._commandBus.execute(new CustomSmtpCreateCommand(entity));
	}

	/**
	 * UPDATE smtp by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.CUSTOM_SMTP_EDIT)
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ICustomSmtp['id'],
		@Body() entity: UpdateCustomSmtpDTO
	): Promise<ICustomSmtp> {
		return await this._commandBus.execute(new CustomSmtpUpdateCommand(id, entity));
	}

	/**
	 * Removes a configuration — the `DELETE /smtp/:id` route the CRUD base maps, restated only to state the write
	 * grant: left inherited it ran under the class's read grant. The status code and the service call are the
	 * inherited route's own.
	 *
	 * @param id The configuration to remove.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Record deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@Permissions(PermissionsEnum.CUSTOM_SMTP_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.delete(id, ...options);
	}

	/**
	 * Withdraws a configuration without removing the row — the `DELETE /smtp/:id/soft` route the CRUD base maps,
	 * restated only to state the write grant (owner decision 5: the soft-delete/recover pair requires the
	 * controller's own edit grant). Path, status, validation and service call are the inherited route's own.
	 *
	 * @param id The configuration to withdraw.
	 * @param options The inherited route's rest parameter, forwarded to the service unchanged.
	 * @returns The withdrawn configuration.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@Permissions(PermissionsEnum.CUSTOM_SMTP_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<CustomSmtp> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a withdrawn configuration — the `PUT /smtp/:id/recover` route the CRUD base maps, under the same
	 * write grant: restoring undoes a removal.
	 *
	 * @param id The configuration to restore.
	 * @param options The inherited route's rest parameter, forwarded to the service unchanged.
	 * @returns The restored configuration.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@Permissions(PermissionsEnum.CUSTOM_SMTP_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<CustomSmtp> {
		return await super.softRecover(id, ...options);
	}
}
