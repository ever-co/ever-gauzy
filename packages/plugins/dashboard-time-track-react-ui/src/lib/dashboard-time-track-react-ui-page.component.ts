import { ChangeDetectionStrategy, Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { NbCardModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { PageExtensionSlotComponent } from '@gauzy/plugin-ui';
import { DateRangePickerBuilderService } from '@gauzy/ui-core/core';
import { ComponentsModule } from '@gauzy/ui-core/shared';
import { ReactHostDirective } from '@gauzy/ui-react';
import { DashboardTimeTrackReactUiPage, type DashboardTimeTrackReactUiPageProps } from './components/DashboardTimeTrackReactUiPage';
import { headerTitleKey } from './utils/period.utils';

/**
 * DashboardTimeTrackReactUiPageComponent
 *
 * The routed Angular host of the React Time Tracking dashboard. It owns ONLY the page chrome the
 * Angular tab gets from the app shell — the `nb-card` with the `<h4><ngx-header-title>` title
 * (period prefix + "Time Tracking" + " for <Org>" + breadcrumb trail) and the two header rows —
 * and mounts the React root ONCE in the card body via `[gaReactHost]`. The React root renders the
 * header controls (timezone filter, Manage widgets, Auto Refresh, Refresh) into the two header
 * slots below through portals, so the header reads exactly like the Angular flavour while every
 * control is React.
 *
 * `props` is built once in `ngOnInit` (the slot elements are `static: true` view children), not
 * in the template — a fresh object per change-detection pass would re-render the React root on
 * every tick.
 */
@Component({
	selector: 'gz-dashboard-time-track-react-ui-page',
	standalone: true,
	imports: [NbCardModule, TranslateModule, ComponentsModule, PageExtensionSlotComponent, ReactHostDirective],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<nb-card class="card">
			<nb-card-header class="card-header">
				<div class="row">
					<div class="col-auto">
						<h4>
							<ngx-header-title>
								@if (headerTitleKey(); as key) {
									{{ key | translate }}
								}
								{{ 'TIMESHEET.TIME_TRACKING' | translate }}
							</ngx-header-title>
						</h4>
					</div>
					<div class="mb-4 ml-auto col-auto d-flex align-items-center" #headerActions></div>
				</div>
				<div class="row">
					<div class="mb-2 ml-auto col-auto d-flex align-items-center" #headerToolbar></div>
				</div>
			</nb-card-header>
			<nb-card-body class="card-body">
				<div [gaReactHost]="page" [props]="props"></div>
				<!-- Plugin Extension Slots (React, Vue, …) — the Angular tab renders the same two. -->
				<ga-page-extension-slot slotId="dashboard-widgets"></ga-page-extension-slot>
				<ga-page-extension-slot slotId="dashboard-windows"></ga-page-extension-slot>
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			/* Same page-card treatment as the Angular tab (time-tracking.component.scss). */
			:host .card {
				background-color: var(--gauzy-card-2);
				height: auto;
			}
			:host .card-header {
				background-color: unset;
			}
			:host .card-body {
				background-color: var(--gauzy-card-2);
				padding: 1rem 0.5rem 1rem 18px;
				border-radius: 0 0 var(--border-radius) var(--border-radius);
				height: auto !important;
			}
			:host-context([dir='rtl']) .card-body {
				padding: 1rem 18px 1rem 0.5rem;
			}
		`
	]
})
export class DashboardTimeTrackReactUiPageComponent implements OnInit {
	private readonly dateRangePickerBuilderService = inject(DateRangePickerBuilderService);

	@ViewChild('headerActions', { static: true }) private readonly headerActions!: ElementRef<HTMLElement>;
	@ViewChild('headerToolbar', { static: true }) private readonly headerToolbar!: ElementRef<HTMLElement>;

	/** The React root component. */
	readonly page = DashboardTimeTrackReactUiPage;

	/** Built once in `ngOnInit`; see the class doc. */
	props: DashboardTimeTrackReactUiPageProps = {};

	/**
	 * `TIMESHEET.DAILY | WEEKLY | MONTHLY` — the same prefix `TimeTrackingComponent.headerTitle`
	 * derives from the selected date range (`null` for a custom range, like Angular).
	 */
	readonly headerTitleKey = toSignal(
		this.dateRangePickerBuilderService.selectedDateRange$.pipe(map((range) => headerTitleKey(range))),
		{ initialValue: headerTitleKey(this.dateRangePickerBuilderService.selectedDateRange) }
	);

	ngOnInit(): void {
		this.props = {
			headerActionsHost: this.headerActions.nativeElement,
			headerToolbarHost: this.headerToolbar.nativeElement
		};
	}
}
