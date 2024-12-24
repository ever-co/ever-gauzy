import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { IDashboard } from './dashboard.model';
import { IEmployeeEntityInput } from './employee.model';
import { IRelationalOrganizationProject } from './organization-projects.model';
import { IRelationalOrganizationTeam } from './organization-team.model';

export interface IDashboardWidget
	extends IBasePerTenantAndOrganizationEntityModel,
		IEmployeeEntityInput,
		IRelationalOrganizationProject,
		IRelationalOrganizationTeam {
	name?: string;
	order?: number;
	size?: DashboardWidgetWidth[];
	color?: string;
	isVisible?: boolean;
	options?: JsonData;
	dashboardId?: ID;
	dashboard?: IDashboard;
}

export type DashboardWidgetWidth = 3 | 4 | 6 | 8 | 12;

export interface IDashboardWidgetCreateInput extends IDashboardWidget {}

export interface IDashboardWidgetUpdateInput extends IDashboardWidgetCreateInput {}
