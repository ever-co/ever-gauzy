import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoItemSkeletonComponent } from './video-item-skeleton.component';

describe('VideoItemSkeletonComponent', () => {
	let component: VideoItemSkeletonComponent;
	let fixture: ComponentFixture<VideoItemSkeletonComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [VideoItemSkeletonComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(VideoItemSkeletonComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
