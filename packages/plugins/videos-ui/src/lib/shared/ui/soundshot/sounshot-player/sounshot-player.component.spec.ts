import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SounshotPlayerComponent } from './sounshot-player.component';

describe('SounshotPlayerComponent', () => {
  let component: SounshotPlayerComponent;
  let fixture: ComponentFixture<SounshotPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SounshotPlayerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SounshotPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
