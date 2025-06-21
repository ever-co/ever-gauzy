import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NpmFormComponent } from './npm-form.component';

describe('NpmFormComponent', () => {
  let component: NpmFormComponent;
  let fixture: ComponentFixture<NpmFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NpmFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NpmFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
