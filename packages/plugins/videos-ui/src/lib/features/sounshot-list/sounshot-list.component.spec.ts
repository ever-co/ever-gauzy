import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SounshotListComponent } from './sounshot-list.component';

describe('SounshotListComponent', () => {
  let component: SounshotListComponent;
  let fixture: ComponentFixture<SounshotListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SounshotListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SounshotListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
