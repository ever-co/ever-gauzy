import { Component, OnInit, ViewChild } from '@angular/core';
import { Message } from '@gauzy/api-interface';
import { HttpClient } from '@angular/common/http';
import { EMLINK } from 'constants';
import { NbCalendarMonthCellComponent } from '@nebular/theme';

@Component({
  selector: 'ea-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  host: {
    '(document:click)': 'clickOutside($event)'
  }
})
export class DashboardComponent implements OnInit {
  hello$ = this.http.get<Message>('/api/hello');
  people = [
    {
      id: 'all',
      firstName: 'Employees',
      avatar: 'https://files.slack.com/files-pri/T0BBDDG2G-FKDK1Q2LB/all.jpg'
    },
    {
      id: 'd9203kr3kf3wf3d3d3',
      firstName: 'Emil',
      lastName: 'Momchilov',
      avatar: 'https://www.w3schools.com/howto/img_avatar.png'
    },
    {
      id: '232d2domd039023',
      firstName: 'Someone',
      lastName: 'Someoneton',
      avatar: 'https://www.w3schools.com/howto/img_avatar.png'
    },
    {
      id: '8d932h9d823hf2',
      firstName: 'Boyan',
      lastName: 'Stanchev',
      avatar: 'https://www.w3schools.com/howto/img_avatar.png'
    }
  ];
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
  selectedEmployeeId = 'all';
  selectedCompanyId: string;
  uselessCancer: string[];
  monthCellComponent = NbCalendarMonthCellComponent;
  loadCalendar = false;
  date = new Date();
  min = new Date(this.date.getFullYear() - 9, 6, 15);
  max = new Date();
  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    //Add 'implements OnInit' to the class.
    this.date.setMonth(this.date.getMonth() - 1);
  }

  clickOutside(event) {
    if (!document.getElementById('dashboard-calendar').contains(event.target)) {
      this.loadCalendar = false;
    }
  }
  getShortenedName(firstName, lastName) {
    if (firstName && lastName) {
      return firstName + ' ' + lastName[0] + '.';
    } else {
      return firstName || lastName || '[error: bad name]';
    }
  }

  getFullName(firstName, lastName) {
    return firstName && lastName
      ? firstName + ' ' + lastName
      : firstName || lastName;
  }

  searchEmployee(term: string, item: any) {
    if (item.firstName && item.lastName) {
      return (
        item.firstName.toLowerCase().includes(term) ||
        item.lastName.toLowerCase().includes(term)
      );
    } else if (item.firstName) {
      return item.firstName.toLowerCase().includes(term);
    } else if (item.lastName) {
      return item.lastName.toLowerCase().includes(term);
    }
  }

  handleMonthChange(event) {
    this.loadCalendar = false;
  }

  formatDateMMMMyy(date) {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];

    const monthIndex = date.getMonth();
    const year = date.getFullYear();

    return monthNames[monthIndex] + ', ' + year;
  }

  getDefaultDate() {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date;
  }

  selectEmployee(event) {
    if (event === undefined) {
      this.selectedEmployeeId = 'all';
    }
  }
}
