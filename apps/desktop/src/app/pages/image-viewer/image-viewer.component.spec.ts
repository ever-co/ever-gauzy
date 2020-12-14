import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageViewerComponent } from './image-viewer.component';

describe('ImageViewerComponent', () => {
	let component: ImageViewerComponent;
	let fixture: ComponentFixture<ImageViewerComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ImageViewerComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(ImageViewerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
