import { IHelpCenter, IOrganization, ITenant } from '@gauzy/contracts';
import { Connection } from 'typeorm';
import { HelpCenter } from './help-center.entity';
import { DEFAULT_HELP_CENTER_MENUS } from './default-help-centers';

export const createHelpCenter = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
): Promise<IHelpCenter[]> => {
	const helpCenterMenuList: IHelpCenter[] = DEFAULT_HELP_CENTER_MENUS;
	for (const tenant of tenants) { 
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			for (const node of helpCenterMenuList) {
				const helpCenter: IHelpCenter = {
					...node,
					tenant,
					organization
				};
				helpCenter.children.forEach((child: IHelpCenter) => {
					child.organization = organization;
					child.tenant = tenant;
				});
				const entity = await createEntity(connection, helpCenter);
				await connection.manager.save(entity);
			}
		}
	}
	return helpCenterMenuList;
};

const createEntity = async (connection: Connection, node: IHelpCenter) => {
	if (!node) {
		return;
	}
	return connection.manager.create(HelpCenter, node);
};
