import { RequestContext } from '@gauzy/core';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PluginService } from '../../domain/services/plugin.service';

@Injectable()
export class PluginOwnerGuard implements CanActivate {
	constructor(private readonly pluginService: PluginService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const pluginId = this.getPluginIdFromRequest(request);
		const employeeId = RequestContext.currentEmployeeId();

		if (!pluginId) {
			throw new ForbiddenException('Plugin ID is required.');
		}
		if (!employeeId) {
			throw new ForbiddenException('Employee ID is required.');
		}

		const isOwner = await this.pluginService.validatePluginOwnership(pluginId, employeeId);

		if (!isOwner) {
			throw new ForbiddenException('You do not have permission to access this plugin.');
		}

		return true;
	}

	private getPluginIdFromRequest(request: any): string | undefined {
		return request.params?.id || request.body?.id || request.params?.pluginId || request.body?.pluginId;
	}
}
