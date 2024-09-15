import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskSelectorComponent } from './task-selector.component';

describe('TaskSelectorComponent', () => {
  let component: TaskSelectorComponent;
  let fixture: ComponentFixture<TaskSelectorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TaskSelectorComponent]
    });
    fixture = TestBed.createComponent(TaskSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
