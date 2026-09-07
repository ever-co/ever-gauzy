import { NO_ERRORS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DownloadQueueService } from '../../shared/services/download/download-queue.service';
import { VideoDownloadManagerComponent } from './video-download-manager.component';

// Minimal stubs for the pipes the template resolves by name. The real `translate`
// (@ngx-translate) and `fileSize` pipes live in app-level modules the component's own
// NgModule pulls in at runtime; the spec only needs the names to exist so the template
// compiles. Unknown pipes are NOT silenced by NO_ERRORS_SCHEMA, so they are declared here.
@Pipe({ name: 'translate', standalone: false })
class TranslateStubPipe implements PipeTransform {
	transform(value: unknown): unknown {
		return value;
	}
}

@Pipe({ name: 'fileSize', standalone: false })
class FileSizeStubPipe implements PipeTransform {
	transform(value: unknown): unknown {
		return value;
	}
}

describe('VideoDownloadManagerComponent', () => {
	let component: VideoDownloadManagerComponent;
	let fixture: ComponentFixture<VideoDownloadManagerComponent>;

	// The real DownloadQueueService is `providedIn: 'root'` but its constructor cascades into
	// FileDownloadService -> ErrorHandlingService -> ToastrService, none of which are available
	// in the isolated test environment (ToastrService injection fails with NG0203). The component
	// only reads `queue$` and `downloadStatus$`, so a lightweight stub is all it needs.
	const downloadQueueServiceMock: Partial<DownloadQueueService> = {
		queue$: of([]),
		downloadStatus$: of({})
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [VideoDownloadManagerComponent, TranslateStubPipe, FileSizeStubPipe],
			providers: [{ provide: DownloadQueueService, useValue: downloadQueueServiceMock }],
			// The template renders app-level custom elements (nb-card, nb-icon, nb-progress-bar,
			// plug-action-button, ngx-no-data-message) whose modules are out of scope for a unit
			// test of this component; NO_ERRORS_SCHEMA lets the template compile without them.
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
		fixture = TestBed.createComponent(VideoDownloadManagerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
