import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimeTrackerFormComponent } from './time-tracker-form.component';

describe('TimeTrackerFormComponent', () => {
  let component: TimeTrackerFormComponent;
  let fixture: ComponentFixture<TimeTrackerFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TimeTrackerFormComponent]
    });
    fixture = TestBed.createComponent(TimeTrackerFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
