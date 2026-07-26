import { IBasePerTenantAndOrganizationEntityModel, JsonData, OmitFields } from './base-entity.model';
import { IDashboardWidget } from './dashboard-widget.model';
import { IEmployeeEntityInput } from './employee.model';
import { ExcludeCreatedByUserFields } from './user.model';

/**
 * Interface representing a Dashboard entity.
 */
export interface IDashboard extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	name: string;
	identifier: string;
	description?: string;
	contentHtml?: JsonData;
	isDefault?: boolean;
	widgets?: IDashboardWidget[];
}

/**
 * Input interface for creating a Dashboard entity.
 */
export interface IDashboardCreateInput
	extends OmitFields<IDashboard, 'isDefault'>,
		ExcludeCreatedByUserFields<IDashboard> {}

/**
 * Input interface for updating a Dashboard entity.
 *
 * Note: `isDefault` is intentionally allowed here (while excluded from creation),
 * so an existing dashboard can be promoted to be the user's default one.
 */
export interface IDashboardUpdateInput extends Partial<IDashboardCreateInput>, Pick<IDashboard, 'isDefault'> {}

/**
 * Serialized state of a single draggable widget/window of the dashboard
 * widget system (mirrors the `GuiDrag.toObject()` shape used by the UI).
 */
export interface IDashboardLayoutItem {
	position: number;
	title?: string;
	hide?: boolean;
	isCollapse?: boolean;
	isExpand?: boolean;
}

/**
 * Persisted layout of a custom dashboard: which widgets/windows are visible,
 * their order and collapse state. Stored in `IDashboard.contentHtml`.
 */
export interface IDashboardLayout {
	widgets?: IDashboardLayoutItem[];
	windows?: IDashboardLayoutItem[];
}
