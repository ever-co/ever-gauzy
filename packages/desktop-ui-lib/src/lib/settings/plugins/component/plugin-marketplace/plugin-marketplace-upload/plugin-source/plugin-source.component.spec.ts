import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PluginSourceComponent } from './plugin-source.component';

describe('PluginSourceComponent', () => {
  let component: PluginSourceComponent;
  let fixture: ComponentFixture<PluginSourceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PluginSourceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PluginSourceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
