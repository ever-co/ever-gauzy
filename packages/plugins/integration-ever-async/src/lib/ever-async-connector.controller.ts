import {
	CanActivate,
	Controller,
	ExecutionContext,
	Get,
	Injectable,
	Query,
	Req,
	UseGuards,
	Header
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '@gauzy/common';
import { EverAsyncConnectorScope, EverAsyncIntegrationService } from './ever-async-integration.service';

type ConnectorRequest = Request & { everAsyncScope: EverAsyncConnectorScope };

@Injectable()
export class EverAsyncConnectorGuard implements CanActivate {
	constructor(private readonly service: EverAsyncIntegrationService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<ConnectorRequest>();
		request.everAsyncScope = await this.service.authenticateConnector(
			request.get('X-INTEGRATION-ID') ?? '',
			request.get('X-APP-ID') ?? '',
			request.get('X-API-KEY') ?? ''
		);
		return true;
	}
}

/** Public bypasses the user JWT guard only; the dedicated credential guard is mandatory. */
@Public()
@UseGuards(EverAsyncConnectorGuard)
@ApiTags('Ever Async Connector')
@ApiHeader({ name: 'X-INTEGRATION-ID', required: true })
@ApiHeader({ name: 'X-APP-ID', required: true })
@ApiHeader({ name: 'X-API-KEY', required: true })
@Controller('/integration/ever-async/connector')
export class EverAsyncConnectorController {
	constructor(private readonly service: EverAsyncIntegrationService) {}

	@Get('/status')
	@Header('Cache-Control', 'no-store')
	status(@Req() request: ConnectorRequest) {
		const { integrationTenantId, tenantId, organizationId } = request.everAsyncScope;
		return { integrationTenantId, tenantId, organizationId, isEnabled: true };
	}

	@Get('/tasks')
	@Header('Cache-Control', 'no-store')
	tasks(
		@Req() request: ConnectorRequest,
		@Query('chatUserId') chatUserId?: string,
		@Query('taskId') taskId?: string,
		@Query('channel') channel?: string,
		@Query('workspace') workspace?: string
	) {
		return this.service.getConnectorTasks(request.everAsyncScope, { chatUserId, taskId, channel, workspace });
	}
}
