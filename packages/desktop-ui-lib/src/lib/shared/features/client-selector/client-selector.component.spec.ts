import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientSelectorComponent } from './client-selector.component';

describe('ClientSelectorComponent', () => {
  let component: ClientSelectorComponent;
  let fixture: ComponentFixture<ClientSelectorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ClientSelectorComponent]
    });
    fixture = TestBed.createComponent(ClientSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
