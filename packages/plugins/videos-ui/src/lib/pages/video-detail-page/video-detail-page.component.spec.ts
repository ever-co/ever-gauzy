import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoDetailPageComponent } from './video-detail-page.component';

describe('VideoDetailPageComponent', () => {
	let component: VideoDetailPageComponent;
	let fixture: ComponentFixture<VideoDetailPageComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [VideoDetailPageComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(VideoDetailPageComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
