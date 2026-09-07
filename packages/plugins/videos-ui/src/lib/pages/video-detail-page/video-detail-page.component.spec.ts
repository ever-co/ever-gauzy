import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions } from '@ngneat/effects-ng';
import { of, Subject } from 'rxjs';
import { VideoQuery } from '../../+state/video.query';
import { VideoStore } from '../../+state/video.store';
import { VideoDetailPageComponent } from './video-detail-page.component';

describe('VideoDetailPageComponent', () => {
	let component: VideoDetailPageComponent;
	let fixture: ComponentFixture<VideoDetailPageComponent>;

	// Minimal mocks for the services the component injects.
	const activatedRouteMock = {
		params: of({ id: '1' }),
		snapshot: { params: { id: '1' } }
	};
	const routerMock = {
		events: new Subject<unknown>(),
		navigated: false
	};
	const actionsMock = { dispatch: jest.fn() };
	const videoQueryMock = {
		select: () => of({ count: 0 }),
		count$: of(0),
		video$: of(null)
	};
	const videoStoreMock = { update: jest.fn() };

	beforeEach(async () => {
		// The template uses `@defer(on viewport)`, whose trigger constructs an IntersectionObserver;
		// jsdom does not implement one, so provide a no-op stub to avoid a runtime ReferenceError.
		(globalThis as any).IntersectionObserver = class {
			observe(): void {}
			unobserve(): void {}
			disconnect(): void {}
			takeRecords(): [] {
				return [];
			}
		};

		await TestBed.configureTestingModule({
			declarations: [VideoDetailPageComponent],
			// The template renders custom elements (nb-tabset, plug-*, ngx-no-data-message) that are
			// not declared here; the global test-setup enables errorOnUnknownElements, so suppress them.
			schemas: [NO_ERRORS_SCHEMA],
			providers: [
				{ provide: ActivatedRoute, useValue: activatedRouteMock },
				{ provide: Router, useValue: routerMock },
				{ provide: Actions, useValue: actionsMock },
				{ provide: VideoQuery, useValue: videoQueryMock },
				{ provide: VideoStore, useValue: videoStoreMock }
			]
		}).compileComponents();
		fixture = TestBed.createComponent(VideoDetailPageComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
