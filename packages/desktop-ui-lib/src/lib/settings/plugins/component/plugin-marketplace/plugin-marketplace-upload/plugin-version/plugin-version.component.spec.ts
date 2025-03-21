import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PluginVersionComponent } from './plugin-version.component';

describe('PluginVersionComponent', () => {
  let component: PluginVersionComponent;
  let fixture: ComponentFixture<PluginVersionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PluginVersionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PluginVersionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
