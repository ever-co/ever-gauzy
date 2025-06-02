import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CdnFormComponent } from './cdn-form.component';

describe('CdnFormComponent', () => {
  let component: CdnFormComponent;
  let fixture: ComponentFixture<CdnFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CdnFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CdnFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
