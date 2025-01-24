import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoItemComponent } from './video-item.component';

describe('VideoItemComponent', () => {
  let component: VideoItemComponent;
  let fixture: ComponentFixture<VideoItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VideoItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VideoItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
