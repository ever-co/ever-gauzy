import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogCreateSourceComponent } from './dialog-create-source.component';

describe('DialogCreateSourceComponent', () => {
  let component: DialogCreateSourceComponent;
  let fixture: ComponentFixture<DialogCreateSourceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DialogCreateSourceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DialogCreateSourceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
