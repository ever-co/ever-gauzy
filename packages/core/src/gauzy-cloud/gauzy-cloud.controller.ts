import { Body, Controller, HttpStatus, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IOrganizationCreateInput, ITenantCreateInput, IUserRegistrationInput, PermissionsEnum } from '@gauzy/contracts';
import { CloudMigrateInterceptor } from './../core/interceptors';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { GauzyCloudOrganizationMigrateCommand, GauzyCloudTenantMigrateCommand, GauzyCloudUserMigrateCommand } from './commands';

@UseInterceptors(CloudMigrateInterceptor)
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard, PermissionGuard)
@Controller()
export class GauzyCloudController {
	
	constructor(
		private readonly commandBus: CommandBus
	) {}

	@ApiOperation({ summary: 'Migrate self hosted to gauzy cloud hosted' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The user has been successfully created in the Gauzy cloud.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.MIGRATE_GAUZY_CLOUD)
	@Post()
	async migrateToCloud(@Body() body: IUserRegistrationInput) {
		return await this.commandBus.execute(
			new GauzyCloudUserMigrateCommand(body)
		);
	}

	@ApiOperation({ summary: 'Migrate self hosted tenant into the gauzy cloud tenant' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The tenant has been successfully created in the Gauzy cloud.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.MIGRATE_GAUZY_CLOUD)
	@Post('tenant/:token')
	async migrateTenant(
		@Body() body: ITenantCreateInput,
		@Param('token') token: string
	) {
		return await this.commandBus.execute(
			new GauzyCloudTenantMigrateCommand(body, token)
		);
	}

	@ApiOperation({ summary: 'Migrate self hosted organization into the gauzy cloud organization' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The organization has been successfully created in the Gauzy cloud.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.MIGRATE_GAUZY_CLOUD)
	@Post('organization/:token')
	async migrateOrgnaization(
		@Body() body: IOrganizationCreateInput,
		@Param('token') token: string
	) {
		return await this.commandBus.execute(
			new GauzyCloudOrganizationMigrateCommand(body, token)
		);
	}
}