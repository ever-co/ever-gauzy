import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PluginMetadataComponent } from './plugin-metadata.component';

describe('PluginMetadataComponent', () => {
  let component: PluginMetadataComponent;
  let fixture: ComponentFixture<PluginMetadataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PluginMetadataComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PluginMetadataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
