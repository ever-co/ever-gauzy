import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoShareComponent } from './video-share.component';

describe('VideoShareComponent', () => {
  let component: VideoShareComponent;
  let fixture: ComponentFixture<VideoShareComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VideoShareComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VideoShareComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
