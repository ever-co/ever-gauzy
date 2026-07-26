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
 * Persisted layout of a custom dashboard (v1): which widgets/windows are
 * visible, their order and collapse state. Stored in `IDashboard.contentHtml`.
 *
 * v1 documents are snapshots of the legacy `GuiDrag` widget system — widgets
 * are identified by POSITION only, so they can be reordered but never placed
 * freely. Superseded by {@link IDashboardLayoutV2}; still read for dashboards
 * created before the builder shipped.
 */
export interface IDashboardLayout {
	widgets?: IDashboardLayoutItem[];
	windows?: IDashboardLayoutItem[];
}

/**
 * A single widget instance placed on a dashboard canvas.
 *
 * Unlike {@link IDashboardLayoutItem} (positional identity), a placement has a
 * stable `instanceId` and names the widget it renders via `widgetId`, so the
 * same widget can appear multiple times with different configuration.
 */
export interface IDashboardWidgetPlacement {
	/** Stable identity of this placement (uuid). */
	instanceId: string;
	/** Registry key of the widget to render, e.g. `time-tracking.members-worked`. */
	widgetId: string;
	/** Grid origin, 0-based, in a 12 column grid. */
	x: number;
	y: number;
	/** Span, in grid columns / row units. */
	w: number;
	h: number;
	/** User override of the widget's registry title. */
	title?: string;
	/** Per-instance settings (e.g. a project/team/employee scope). */
	config?: Record<string, unknown>;
	/** Temporarily hidden without being removed from the canvas. */
	hidden?: boolean;
}

/**
 * A user-created tab inside a custom dashboard. Each tab owns its own canvas.
 */
export interface IDashboardTab {
	/** Stable identity of the tab (uuid). */
	id: string;
	name: string;
	icon?: string;
	/** Ascending display order in the tab strip. */
	order: number;
	widgets: IDashboardWidgetPlacement[];
}

/**
 * Persisted layout of a custom dashboard (v2 — the dashboard builder).
 *
 * A v2 document is a set of named tabs, each holding freely placed widget
 * instances. It intentionally extends {@link IDashboardLayout} so a v2
 * document can still carry a v1 snapshot for backward compatibility while a
 * dashboard is migrated.
 */
export interface IDashboardLayoutV2 extends IDashboardLayout {
	/** Schema version. Absent/`1` = legacy snapshot, `2` = builder document. */
	version: 2;
	tabs: IDashboardTab[];
}

/**
 * Either persisted layout shape, as read from `IDashboard.contentHtml`.
 */
export type DashboardLayout = IDashboardLayout | IDashboardLayoutV2;
