import { NO_ERRORS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NbDialogRef } from '@nebular/theme';
import { VideoMetadataComponent } from './video-metadata.component';

// With no `video` input set, the template renders its `@else` branch, whose only
// dependency is the `translate` pipe. Stub it so `detectChanges()` can render.
// (The real `@ngx-translate/core` resolves against a nested `@angular/core` here and
// fails to inject — a lightweight stub is all the template genuinely needs.)
@Pipe({ name: 'translate', standalone: false })
class MockTranslatePipe implements PipeTransform {
	transform(value: string): string {
		return value;
	}
}

describe('VideoMetadataComponent', () => {
	let component: VideoMetadataComponent;
	let fixture: ComponentFixture<VideoMetadataComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [VideoMetadataComponent, MockTranslatePipe],
			// The component injects NbDialogRef (it is opened as a dialog); provide a minimal mock.
			providers: [{ provide: NbDialogRef, useValue: { close: jest.fn() } }],
			// The @else branch renders `ngx-no-data-message`, a Gauzy element not declared here;
			// NO_ERRORS_SCHEMA lets it render without pulling in its whole module.
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
		fixture = TestBed.createComponent(VideoMetadataComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
