import { ID } from '@gauzy/contracts';
import { UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { Body, Controller, Param, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VerifyPluginCommand } from '../../application';
import { VerifyPluginDTO } from '../../shared';

@ApiTags('Plugin Security')
@Controller('/plugins/:id/verifications')
export class PluginSecurityController {
	constructor(private readonly commandBus: CommandBus) {}

	@ApiOperation({ summary: 'Create or update plugin verification' })
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Plugin ID in UUID format' })
	@ApiBody({ type: VerifyPluginDTO, description: 'Verification data for the plugin' })
	@ApiResponse({ status: 200, description: 'Plugin verification successful' })
	@ApiResponse({ status: 400, description: 'Bad request - validation failed' })
	@ApiResponse({ status: 404, description: 'Plugin not found' })
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Post()
	public async createVerification(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: VerifyPluginDTO
	): Promise<boolean> {
		return this.commandBus.execute(new VerifyPluginCommand(id, input));
	}
}
