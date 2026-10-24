import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { ForbiddenException } from '@nestjs/common';
import { IPluginTenant } from '../../shared';

/** The flags of a plugin's installation that decide whether it runs and whether an administrator signs it off. */
export type PluginTenantAccessFlags = Pick<IPluginTenant, 'enabled' | 'requiresApproval' | 'isMandatory'>;

/** The flags a new installation gets when the request leaves them out (see `PluginTenant.create`). */
export const NEW_PLUGIN_TENANT_ACCESS_FLAGS: Readonly<PluginTenantAccessFlags> = Object.freeze({
	enabled: true,
	requiresApproval: true,
	isMandatory: false
});

/**
 * Refuses a create or edit that changes an access flag the caller may not change on the flag's own route.
 *
 * `PATCH /plugin-tenants/:id/enable` and `/disable` state `PLUGIN_ENABLE` and `PLUGIN_DISABLE`, and `PATCH /approval`
 * `PLUGIN_RESTRICT`, which only ADMIN and SUPER_ADMIN hold. `POST /plugin-tenants` and `PUT /plugin-tenants/:id` state
 * `PLUGIN_CONFIGURE` (DATA_ENTRY holds it) and wrote the same flags, so `PUT { "enabled": true, "requiresApproval":
 * false }` turned a plugin on and dropped its approval without either grant. A flag the request leaves out, or sends
 * unchanged, needs nothing more: an edit form that resends the whole record keeps working.
 *
 * @param input - The flags the request sets.
 * @param current - The flags as they stand: the stored row, or {@link NEW_PLUGIN_TENANT_ACCESS_FLAGS} on create.
 * @throws ForbiddenException when a changed flag needs a grant the caller does not hold.
 */
export function assertMayChangeAccessFlags(
	input: Partial<PluginTenantAccessFlags> | null | undefined,
	current: Partial<PluginTenantAccessFlags>
): void {
	const changes = (flag: keyof PluginTenantAccessFlags) =>
		input?.[flag] !== undefined && input[flag] !== null && Boolean(input[flag]) !== Boolean(current?.[flag]);

	if (changes('enabled')) {
		const grant = input.enabled ? PermissionsEnum.PLUGIN_ENABLE : PermissionsEnum.PLUGIN_DISABLE;
		if (!RequestContext.hasPermission(grant)) {
			throw new ForbiddenException(`Turning the plugin ${input.enabled ? 'on' : 'off'} requires ${grant}.`);
		}
	}
	if (
		(changes('requiresApproval') || changes('isMandatory')) &&
		!RequestContext.hasPermission(PermissionsEnum.PLUGIN_RESTRICT)
	) {
		throw new ForbiddenException(
			`Changing the plugin's approval or mandatory flag requires ${PermissionsEnum.PLUGIN_RESTRICT}.`
		);
	}
}
