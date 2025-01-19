import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoDownloadManagerComponent } from './video-download-manager.component';

describe('VideoDownloadManagerComponent', () => {
  let component: VideoDownloadManagerComponent;
  let fixture: ComponentFixture<VideoDownloadManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VideoDownloadManagerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VideoDownloadManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
