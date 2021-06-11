import { Body, Controller, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IUserRegistrationInput } from '@gauzy/contracts';
import { TenantPermissionGuard } from './../shared/guards';

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
	@Post('migrate')
	async migrateToCloud(@Body() body: IUserRegistrationInput) {
		console.log(body);
	}
}