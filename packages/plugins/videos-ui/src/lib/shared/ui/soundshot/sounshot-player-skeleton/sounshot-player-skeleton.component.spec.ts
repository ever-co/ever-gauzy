import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SounshotPlayerSkeletonComponent } from './sounshot-player-skeleton.component';

describe('SounshotPlayerSkeletonComponent', () => {
  let component: SounshotPlayerSkeletonComponent;
  let fixture: ComponentFixture<SounshotPlayerSkeletonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SounshotPlayerSkeletonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SounshotPlayerSkeletonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
