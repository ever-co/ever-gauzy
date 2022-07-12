import { IHelpCenter, IOrganization, ITenant } from '@gauzy/contracts';
import { DataSource } from 'typeorm';
import { HelpCenter } from './help-center.entity';
import { DEFAULT_HELP_CENTER_MENUS } from './default-help-centers';

export const createHelpCenter = async (
	dataSource: DataSource,
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
				const entity = await createEntity(dataSource, helpCenter);
				await dataSource.manager.save(entity);
			}
		}
	}
	return helpCenterMenuList;
};

const createEntity = async (dataSource: DataSource, node: IHelpCenter) => {
	if (!node) {
		return;
	}
	return dataSource.manager.create(HelpCenter, node);
};
