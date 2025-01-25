import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoSkeletonComponent } from './video-skeleton.component';

describe('VideoSkeletonComponent', () => {
	let component: VideoSkeletonComponent;
	let fixture: ComponentFixture<VideoSkeletonComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [VideoSkeletonComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(VideoSkeletonComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
