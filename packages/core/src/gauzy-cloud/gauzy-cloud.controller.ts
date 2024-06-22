import { Body, Controller, HttpStatus, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IOrganizationCreateInput, ITenantCreateInput, IUserRegistrationInput, PermissionsEnum } from '@gauzy/contracts';
import { CloudMigrateInterceptor } from './../core/interceptors';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import {
	i4netCloudOrganizationMigrateCommand,
	i4netCloudTenantMigrateCommand,
	i4netCloudUserMigrateCommand
} from './commands';

@UseInterceptors(CloudMigrateInterceptor)
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.MIGRATE_GAUZY_CLOUD)
@Controller()
export class i4netCloudController {

	constructor(
		private readonly commandBus: CommandBus
	) { }

	@ApiOperation({ summary: 'Migrate self hosted to gauzy cloud hosted' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The user has been successfully created in the i4net cloud.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	async migrateUserToi4netCloud(
		@Body() body: IUserRegistrationInput
	) {
		return await this.commandBus.execute(
			new i4netCloudUserMigrateCommand(body)
		);
	}

	@ApiOperation({ summary: 'Migrate self hosted tenant into the gauzy cloud tenant' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The tenant has been successfully created in the i4net cloud.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('tenant/:token')
	async migrateTenantToi4netCloud(
		@Body() body: ITenantCreateInput,
		@Param('token') token: string
	) {
		return await this.commandBus.execute(
			new i4netCloudTenantMigrateCommand(body, token)
		);
	}

	@ApiOperation({ summary: 'Migrate self hosted organization into the gauzy cloud organization' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The organization has been successfully created in the i4net cloud.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('organization/:token')
	async migrateOrganizationToi4netCloud(
		@Body() body: IOrganizationCreateInput,
		@Param('token') token: string
	) {
		return await this.commandBus.execute(
			new i4netCloudOrganizationMigrateCommand(body, token)
		);
	}
}
