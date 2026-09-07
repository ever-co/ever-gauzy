// `@gauzy/ui-core/shared` is a barrel over the whole app: importing it (the component pulls
// `DeleteConfirmationComponent` from it) drags `selectors.module` → `ngx-daterangepicker-material`
// → `dayjs/esm` — untranspiled ESM the CommonJS test runtime cannot parse. Stub the one symbol the
// component actually uses so the suite can load (same approach as `@gauzy/plugin-docs-ui`).
jest.mock('@gauzy/ui-core/shared', () => ({ DeleteConfirmationComponent: class DeleteConfirmationComponent {} }));

import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { VideoQuery } from '../../+state/video.query';
import { VideoComponent } from './video.component';
describe('VideoComponent', () => {
	let component: VideoComponent;
	let fixture: ComponentFixture<VideoComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TranslateModule.forRoot()],
			declarations: [VideoComponent],
			// The component injects an Akita query, the Nebular dialog service and the effects `Actions`
			// stream; provide minimal doubles so it can be constructed and `ngAfterViewInit` can subscribe.
			providers: [
				{ provide: VideoQuery, useValue: { video$: of(null), isAvailable$: of(false), isLoading$: of(true) } },
				{ provide: NbDialogService, useValue: { open: jest.fn() } },
				{ provide: Actions, useValue: { dispatch: jest.fn() } }
			],
			// The template renders Gauzy/plugin elements (`plug-video-skeleton`, `ngx-no-data-message`, …)
			// not declared here; NO_ERRORS_SCHEMA lets them render without pulling their whole modules.
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
		fixture = TestBed.createComponent(VideoComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
