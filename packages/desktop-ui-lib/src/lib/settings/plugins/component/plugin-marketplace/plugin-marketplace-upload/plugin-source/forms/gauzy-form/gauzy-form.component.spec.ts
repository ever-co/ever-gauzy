import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GauzyFormComponent } from './gauzy-form.component';

describe('GauzyFormComponent', () => {
  let component: GauzyFormComponent;
  let fixture: ComponentFixture<GauzyFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GauzyFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GauzyFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
