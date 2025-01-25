import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoMetadataComponent } from './video-metadata.component';

describe('VideoMetadataComponent', () => {
	let component: VideoMetadataComponent;
	let fixture: ComponentFixture<VideoMetadataComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [VideoMetadataComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(VideoMetadataComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
