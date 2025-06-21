import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CamshotViewerComponent } from './camshot-viewer.component';

describe('CamshotViewerComponent', () => {
  let component: CamshotViewerComponent;
  let fixture: ComponentFixture<CamshotViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CamshotViewerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CamshotViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
