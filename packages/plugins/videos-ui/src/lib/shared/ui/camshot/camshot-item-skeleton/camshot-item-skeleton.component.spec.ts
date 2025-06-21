import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CamshotItemSkeletonComponent } from './camshot-item-skeleton.component';

describe('CamshotItemSkeletonComponent', () => {
  let component: CamshotItemSkeletonComponent;
  let fixture: ComponentFixture<CamshotItemSkeletonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CamshotItemSkeletonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CamshotItemSkeletonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
