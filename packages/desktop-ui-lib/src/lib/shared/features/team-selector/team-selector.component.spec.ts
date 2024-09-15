import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamSelectorComponent } from './team-selector.component';

describe('TeamSelectorComponent', () => {
  let component: TeamSelectorComponent;
  let fixture: ComponentFixture<TeamSelectorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TeamSelectorComponent]
    });
    fixture = TestBed.createComponent(TeamSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
