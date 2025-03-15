import { RequestContext } from '@gauzy/core';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PluginService } from '../../domain/services/plugin.service';
import { IPlugin } from '../../shared/models/plugin.model';

@Injectable()
export class PluginOwnerGuard implements CanActivate {
	constructor(private readonly pluginService: PluginService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const pluginId = request.params.id || request.body.id;
		const employeeId = RequestContext.currentEmployeeId();

		if (!pluginId || !employeeId) {
			throw new ForbiddenException('Plugin ID and employee ID are required');
		}

		await this.findPluginWithPermissionCheck(pluginId, employeeId);

		// If no exception is thrown, the user has permission
		return true;
	}

	private async findPluginWithPermissionCheck(pluginId: string, employeeId: string): Promise<IPlugin> {
		const plugin = await this.pluginService.findOneByWhereOptions({
			id: pluginId
		});

		if (!plugin) {
			throw new NotFoundException(`Plugin with ID ${pluginId} not found`);
		}

		if (plugin.uploadedById !== employeeId) {
			throw new ForbiddenException("You don't have permission to activate this plugin");
		}

		return plugin;
	}
}
