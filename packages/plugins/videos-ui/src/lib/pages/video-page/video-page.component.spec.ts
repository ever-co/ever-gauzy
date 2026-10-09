// `VideoPageComponent` extends `BaseSelectorFilterComponent` and pulls `GauzyFiltersComponent` /
// `TimeZoneService` from the `@gauzy/ui-core/shared` barrel. Importing that barrel transitively loads
// `selectors.module` -> `ngx-daterangepicker-material` -> `dayjs/esm` — ESM this suite's
// `transformIgnorePatterns` does not transform, so the real barrel fails to parse under jest (same
// approach as the sibling `video`/`camshot-list`/`video-item` specs). Stub only the symbols the
// component genuinely uses: a base class that supplies the `subject$` its `ngOnInit` subscribes to,
// plus the `GauzyFiltersComponent` view-child token and the `TimeZoneService` DI token.
jest.mock('@gauzy/ui-core/shared', () => {
	const { Subject } = require('rxjs');
	return {
		BaseSelectorFilterComponent: class BaseSelectorFilterComponent {
			request = { employeeIds: [], projectIds: [], teamIds: [] };
			organization: unknown = undefined;
			subject$ = new Subject();
			getFilterRequest(request: unknown): unknown {
				return request;
			}
		},
		GauzyFiltersComponent: class GauzyFiltersComponent {},
		TimeZoneService: class TimeZoneService {}
	};
});

// The component also injects `Store`, `DateRangePickerBuilderService` and `TimesheetFilterService`
// from the `@gauzy/ui-core/core` barrel. Stub those DI tokens so the real (equally heavy) barrel is
// never loaded; the TestBed provides doubles for each below.
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {},
	DateRangePickerBuilderService: class DateRangePickerBuilderService {},
	TimesheetFilterService: class TimesheetFilterService {}
}));

import { NO_ERRORS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { DateRangePickerBuilderService, Store, TimesheetFilterService } from '@gauzy/ui-core/core';
import { TimeZoneService } from '@gauzy/ui-core/shared';
import { VideoQuery } from '../../+state/video.query';
import { VideoStore } from '../../+state/video.store';
import { VideoPageComponent } from './video-page.component';

// Stub the `translate` pipe the template uses. Importing `TranslateModule.forRoot()` instead pulls the
// real `TranslateService`, which resolves ngx-translate's nested `@angular/core` copy and fails with
// NG0203, so a lightweight pipe (matching the sibling `video-item` spec) is all the template needs.
@Pipe({ name: 'translate', standalone: false })
class MockTranslatePipe implements PipeTransform {
	transform(value: string): string {
		return value;
	}
}

describe('VideoPageComponent', () => {
	let component: VideoPageComponent;
	let fixture: ComponentFixture<VideoPageComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [VideoPageComponent, MockTranslatePipe],
			// Minimal doubles for every dependency the component injects: the effects `Actions` stream,
			// the Akita query/store, and the (stubbed) core services. `datePickerConfig$` is read at
			// field-initialization time, so it must be an observable.
			providers: [
				{ provide: Actions, useValue: { dispatch: jest.fn() } },
				{ provide: VideoQuery, useValue: { count$: of(0), isLoading$: of(false) } },
				{ provide: VideoStore, useValue: { update: jest.fn() } },
				{ provide: Store, useValue: {} },
				{
					provide: DateRangePickerBuilderService,
					useValue: { datePickerConfig$: of({ isSaveDatePicker: false }) }
				},
				{ provide: TimeZoneService, useValue: {} },
				{ provide: TimesheetFilterService, useValue: {} },
				{ provide: TranslateService, useValue: { get: jest.fn(() => of('')), instant: jest.fn((k: string) => k) } }
			],
			// The template renders custom elements (`ngx-gauzy-filters`, `plug-video-list`,
			// `ngx-no-data-message`) and the `nbInfiniteList` directive that are not declared here; the
			// global test-setup enables errorOnUnknownElements/Properties, so suppress them.
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
		fixture = TestBed.createComponent(VideoPageComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
