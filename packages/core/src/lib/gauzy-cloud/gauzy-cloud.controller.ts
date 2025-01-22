import { Body, Controller, HttpStatus, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	IOrganizationCreateInput,
	ITenantCreateInput,
	IUserRegistrationInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { CloudMigrateInterceptor } from './../core/interceptors';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import {
	GauzyCloudOrganizationMigrateCommand,
	GauzyCloudTenantMigrateCommand,
	GauzyCloudUserMigrateCommand
} from './commands';

@UseInterceptors(CloudMigrateInterceptor)
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.MIGRATE_GAUZY_CLOUD)
@Controller('/cloud/migrate')
export class GauzyCloudController {
	constructor(private readonly commandBus: CommandBus) {}

	/**
	 *
	 * @param body
	 * @returns
	 */
	@ApiOperation({ summary: 'Migrate self hosted to gauzy cloud hosted' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The user has been successfully created in the Gauzy cloud.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	async migrateUserToGauzyCloud(@Body() body: IUserRegistrationInput) {
		return await this.commandBus.execute(new GauzyCloudUserMigrateCommand(body));
	}

	/**
	 *
	 * @param body
	 * @param token
	 * @returns
	 */
	@ApiOperation({ summary: 'Migrate self hosted tenant into the gauzy cloud tenant' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The tenant has been successfully created in the Gauzy cloud.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('tenant/:token')
	async migrateTenantToGauzyCloud(@Body() body: ITenantCreateInput, @Param('token') token: string) {
		return await this.commandBus.execute(new GauzyCloudTenantMigrateCommand(body, token));
	}

	/**
	 *
	 * @param body
	 * @param token
	 * @returns
	 */
	@ApiOperation({ summary: 'Migrate self hosted organization into the gauzy cloud organization' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The organization has been successfully created in the Gauzy cloud.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('organization/:token')
	async migrateOrganizationToGauzyCloud(@Body() body: IOrganizationCreateInput, @Param('token') token: string) {
		return await this.commandBus.execute(new GauzyCloudOrganizationMigrateCommand(body, token));
	}
}
