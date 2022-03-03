import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CounterPointComponent } from './counter-point.component';

describe('CounterPointComponent', () => {
  let component: CounterPointComponent;
  let fixture: ComponentFixture<CounterPointComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CounterPointComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CounterPointComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
