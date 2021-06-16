import { Body, Controller, HttpStatus, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IOrganizationCreateInput, ITenantCreateInput, IUserRegistrationInput } from '@gauzy/contracts';
import { TenantPermissionGuard } from './../shared/guards';
import { GauzyCloudUserMigrateCommand } from './commands/gauzy-cloud-user.migrate.command';
import { TransformInterceptor } from './../core/interceptors/transform.interceptor';
import { GauzyCloudTenantMigrateCommand } from './commands/gauzy-cloud-tenant.migrate.command';
import { GauzyCloudOrganizationMigrateCommand } from './commands/gauzy-cloud-organization.migrate.command';

@UseInterceptors(TransformInterceptor)
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
	@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
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
	@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
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
	@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
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