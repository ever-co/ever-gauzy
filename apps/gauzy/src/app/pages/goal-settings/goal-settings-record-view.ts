import { Injector } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { IGoalTimeFrame, IKPI, KpiMetricEnum, KpiOperatorEnum } from '@gauzy/contracts';
import { GoalSettingsService } from '@gauzy/ui-core/core';
import { IRecordViewRouteData, IRecordViewScope, IRecordViewSection } from '@gauzy/ui-core/shared';

/** Mirrors ValueWithUnitComponent: the value followed by the KPI's unit. */
export function kpiValueWithUnit(value: number, unit?: string): string | number | undefined {
	if (value === null || value === undefined) {
		return undefined;
	}
	return unit ? `${value} ${unit}` : value;
}

/**
 * The record stores the enum VALUE ('Numerical', '>=') while the i18n keys are indexed by the enum KEY —
 * reverse-map before translating.
 */
export function translateKpiEnum(
	value: string,
	enumType: Record<string, string>,
	i18nPrefix: string,
	translate: (key: string) => string
): string {
	const key = Object.keys(enumType).find((enumKey) => enumType[enumKey] === value);
	return key ? translate(`${i18nPrefix}.${key}`) : value;
}

/** The time frames grid's status badge: active green, otherwise red. */
export function timeFrameStatusBadge(
	value: string,
	translate: (key: string) => string
): { text: string; class: string } {
	return value === 'Active'
		? { text: translate('PIPELINES_PAGE.ACTIVE'), class: 'success' }
		: { text: translate('PIPELINES_PAGE.INACTIVE'), class: 'danger' };
}

/** A KPI, described for `ngx-record-view`. Shared by the goal settings drawer and the KPI's full page. */
export function buildKpiViewSections(kpi: IKPI, translate: (key: string) => string): IRecordViewSection[] {
	return [
		{
			fields: [
				{ label: 'SM_TABLE.NAME', key: 'name' },
				// The grid renders these through ValueWithUnitComponent — the
				// value followed by the KPI's unit — so the View reads the same.
				{ label: 'SM_TABLE.CURRENT_VALUE', value: kpiValueWithUnit(kpi.currentValue, kpi.unit) },
				{ label: 'SM_TABLE.TARGET_VALUE', value: kpiValueWithUnit(kpi.targetValue, kpi.unit) },
				{ label: 'SM_TABLE.LAST_UPDATED', key: 'updatedAt', type: 'date' }
			]
		},
		{
			fields: [
				{ label: 'FORM.LABELS.DESCRIPTION', key: 'description', type: 'multiline', wide: true },
				{
					label: 'GOALS_PAGE.FORM.LABELS.KPI_METRIC',
					value: translateKpiEnum(kpi.type, KpiMetricEnum, 'GOALS_PAGE.KPI_METRIC', translate)
				},
				{
					label: 'GOALS_PAGE.FORM.LABELS.KPI_SHOULD_BE',
					value: translateKpiEnum(kpi.operator, KpiOperatorEnum, 'GOALS_PAGE.KPI_OPERATOR', translate)
				},
				{ label: 'GOALS_PAGE.FORM.LABELS.LEAD', key: 'lead', type: 'person' }
			]
		}
	];
}

/** A time frame, described for `ngx-record-view` — the grid columns read vertically. */
export function buildTimeFrameViewSections(): IRecordViewSection[] {
	return [
		{
			fields: [
				{ label: 'SM_TABLE.NAME', key: 'name' },
				{ label: 'SM_TABLE.START_DATE', key: 'startDate', type: 'date' },
				{ label: 'SM_TABLE.END_DATE', key: 'endDate', type: 'date' },
				// `status` is the `{ text, class }` badge the grid derives when the rows are loaded.
				{ label: 'SM_TABLE.STATUS', key: 'status', type: 'badge' }
			]
		}
	];
}

const translatorOf = (injector: Injector) => {
	const translateService = injector.get(TranslateService);
	return (key: string) => translateService.instant(key);
};

const settingsScope = (id: string, scope: IRecordViewScope) =>
	({ id, organization: { id: scope.organizationId }, tenantId: scope.tenantId }) as any;

/** `/pages/goals/settings/kpi/:id` — one KPI, full width. */
export const KPI_RECORD_VIEW: IRecordViewRouteData<IKPI> = {
	heading: 'GOALS_PAGE.SETTINGS.KPI',
	backLink: '/pages/goals/settings',
	load: async (id: string, injector: Injector, scope: IRecordViewScope) => {
		const { items } = await injector.get(GoalSettingsService).getAllKPI(settingsScope(id, scope));
		return items?.find((item) => item.id === id) ?? null;
	},
	sections: (kpi, injector) => buildKpiViewSections(kpi, translatorOf(injector)),
	subtitle: (kpi) => kpi.name
};

/** `/pages/goals/settings/time-frame/:id` — one time frame, full width. */
export const TIME_FRAME_RECORD_VIEW: IRecordViewRouteData<IGoalTimeFrame> = {
	heading: 'GOALS_PAGE.SETTINGS.TIME_FRAME_PAGE_TITLE',
	backLink: '/pages/goals/settings',
	load: async (id: string, injector: Injector, scope: IRecordViewScope) => {
		const { items } = await injector.get(GoalSettingsService).getAllTimeFrames(settingsScope(id, scope));
		const timeFrame: any = items?.find((item) => item.id === id);
		return timeFrame
			? { ...timeFrame, status: timeFrameStatusBadge(timeFrame.status, translatorOf(injector)) }
			: null;
	},
	sections: () => buildTimeFrameViewSections(),
	subtitle: (timeFrame) => timeFrame.name
};
