import { NO_ERRORS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { VideoEditComponent } from './video-edit.component';

// Stub for the `translate` pipe. Importing the real @ngx-translate TranslateModule is not viable
// here: that package resolves its own nested `node_modules/@angular` copy, so its TranslatePipe
// injects a `_TranslateService` from a different Angular instance and fails with NG0203.
@Pipe({ name: 'translate', standalone: false })
class TranslatePipeStub implements PipeTransform {
	transform(value: string): string {
		return value;
	}
}

describe('VideoEditComponent', () => {
	let component: VideoEditComponent;
	let fixture: ComponentFixture<VideoEditComponent>;
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ReactiveFormsModule],
			declarations: [VideoEditComponent, TranslatePipeStub],
			providers: [{ provide: NbDialogRef, useValue: { close: jest.fn() } }],
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
		fixture = TestBed.createComponent(VideoEditComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});
	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
