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
	name: string;
	order?: number;
	size?: number;
	color?: string;
	isVisible?: boolean;
	options?: JsonData;
	dashboardId?: ID;
	dashboard?: IDashboard;
}

export interface IDashboardWidgetCreateInput extends IDashboardWidget {}

export interface IDashboardWidgetUpdateInput extends Partial<IDashboardWidgetCreateInput> {}
