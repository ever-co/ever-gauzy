import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SourceContainerComponent } from './source-container.component';

describe('SourceContainerComponent', () => {
  let component: SourceContainerComponent;
  let fixture: ComponentFixture<SourceContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SourceContainerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SourceContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
