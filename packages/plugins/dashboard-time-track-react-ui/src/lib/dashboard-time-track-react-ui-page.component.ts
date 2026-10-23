import { ChangeDetectionStrategy, Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { NbCardModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
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
 * (period prefix + "Time Tracking" + " for <Org>" + breadcrumb trail) and the single header row
 * (`.page-header`) — and mounts the React root ONCE in the card body via `[gaReactHost]`. The
 * React root renders the header controls (Auto Refresh, Refresh, timezone filter, Manage widgets)
 * into the actions slot through a portal, so the header reads exactly like the Angular flavour
 * while every control is React.
 *
 * `props` is built once in `ngOnInit` (the slot element is a `static: true` view child), not
 * in the template — a fresh object per change-detection pass would re-render the React root on
 * every tick.
 */
@Component({
	selector: 'gz-dashboard-time-track-react-ui-page',
	standalone: true,
	imports: [NbCardModule, TranslatePipe, ComponentsModule, PageExtensionSlotComponent, ReactHostDirective],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<nb-card class="card">
			<nb-card-header class="card-header">
				<div class="page-header">
					<div class="page-header__main">
						<h4 class="page-header__title">
							<ngx-header-title>
								@if (headerTitleKey(); as key) {
									{{ key | translate }}
								}
								{{ 'TIMESHEET.TIME_TRACKING' | translate }}
							</ngx-header-title>
						</h4>
					</div>
					<div class="page-header__actions" #headerActions></div>
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
				padding: 1rem 1rem 0.75rem;
			}
			:host .card-body {
				background-color: var(--gauzy-card-2);
				padding: 1rem;
				border-radius: 0 0 var(--border-radius) var(--border-radius);
				height: auto !important;
			}
			/* One header row: title (with its real 18rem basis) and the action strip, which
			   wraps below the title when they no longer fit side by side. */
			:host .page-header {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				justify-content: space-between;
				column-gap: 1rem;
				row-gap: 0.5rem;
				width: 100%;
			}
			:host .page-header__main {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				flex: 1 1 18rem;
				min-width: 0;
			}
			:host .page-header__title {
				margin: 0;
				min-width: 0;
				word-break: normal;
				overflow-wrap: break-word;
			}
			:host .page-header__actions {
				display: flex;
				flex: 0 1 auto;
				margin-inline-start: auto;
			}
			@media screen and (max-width: 48rem) {
				:host .card-body {
					padding: 0.75rem;
				}
			}
			@media screen and (max-width: 36rem) {
				:host .card-header {
					padding: 0.75rem 0.75rem 0.5rem;
				}
			}
		`
	]
})
export class DashboardTimeTrackReactUiPageComponent implements OnInit {
	private readonly dateRangePickerBuilderService = inject(DateRangePickerBuilderService);

	@ViewChild('headerActions', { static: true }) private readonly headerActions!: ElementRef<HTMLElement>;

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
			headerActionsHost: this.headerActions.nativeElement
		};
	}
}
