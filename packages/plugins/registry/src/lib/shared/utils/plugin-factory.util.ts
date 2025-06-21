import { RequestContext } from '@gauzy/core';
import { CreatePluginDTO } from '../dto/create-plugin.dto';
import { PluginVersionDTO } from '../dto/plugin-version.dto';
import { PluginSourceDTO } from '../dto/plugin-source.dto';

export class PluginFactory {
	public static create(input: CreatePluginDTO): CreatePluginDTO {
		const common = this.common(input);

		return {
			...input,
			...common,
			uploadedById: input.uploadedById || RequestContext.currentEmployeeId(),
			version: this.createVersion(input.version)
		};
	}

	public static createVersion(input: PluginVersionDTO): PluginVersionDTO {
		return {
			...input,
			...this.common(input),
			sources: this.createSource(input.sources)
		};
	}

	public static createSource(inputs: PluginSourceDTO[]): PluginSourceDTO[] {
		return inputs.map((input) => ({
			...input,
			...this.common(input)
		}));
	}

	private static common<T extends { tenantId?: string; organizationId?: string }>(input: T) {
		return {
			tenantId: input.tenantId || RequestContext.currentTenantId(),
			organizationId: input.organizationId
		};
	}
}
