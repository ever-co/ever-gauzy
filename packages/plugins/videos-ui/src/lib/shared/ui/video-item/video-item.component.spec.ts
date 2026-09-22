// The component pulls `DeleteConfirmationComponent` from the `@gauzy/ui-core/shared`
// barrel, which transitively loads `ngx-daterangepicker-material` -> `dayjs/esm`
// (ESM this suite's `transformIgnorePatterns` does not transform, so the real barrel
// fails to parse under jest). The component only references the class as a value passed
// to `NbDialogService.open`, so a lightweight mock is all it genuinely needs.
jest.mock('@gauzy/ui-core/shared', () => ({
	DeleteConfirmationComponent: class DeleteConfirmationComponent {}
}));

import { NO_ERRORS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { VideoItemComponent } from './video-item.component';

// With no `video` input set, the template renders its `@else` branch, whose only
// dependency is the `translate` pipe. Stub it so `detectChanges()` can render.
@Pipe({ name: 'translate', standalone: false })
class MockTranslatePipe implements PipeTransform {
	transform(value: string): string {
		return value;
	}
}

describe('VideoItemComponent', () => {
	let component: VideoItemComponent;
	let fixture: ComponentFixture<VideoItemComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [VideoItemComponent, MockTranslatePipe],
			providers: [
				{ provide: Router, useValue: { navigate: jest.fn() } },
				{ provide: ActivatedRoute, useValue: { snapshot: { data: {} } } },
				{ provide: Actions, useValue: { dispatch: jest.fn() } },
				{ provide: NbDialogService, useValue: { open: jest.fn() } }
			],
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
		fixture = TestBed.createComponent(VideoItemComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
