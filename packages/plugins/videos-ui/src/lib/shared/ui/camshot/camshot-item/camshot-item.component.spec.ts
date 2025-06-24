import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CamshotItemComponent } from './camshot-item.component';

describe('CamshotItemComponent', () => {
  let component: CamshotItemComponent;
  let fixture: ComponentFixture<CamshotItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CamshotItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CamshotItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
