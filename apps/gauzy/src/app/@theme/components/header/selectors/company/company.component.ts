import { Component } from '@angular/core';

@Component({
  selector: 'ea-company-selector',
  templateUrl: './company.component.html',
})
export class CompanySelectorComponent {
  companies = [
    {
      id: '23d930jmfd023ff4',
      name: 'Ever2'
    },
    {
      id: '23d930jmfd023ff4',
      name: 'Ever3'
    },
    {
      id: '23d930jmfd023ff4',
      name: 'Ever4'
    }
  ];

  selectedCompanyId: string;
}