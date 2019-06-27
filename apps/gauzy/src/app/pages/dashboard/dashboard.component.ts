import { Component } from '@angular/core';
import { Message } from '@gauzy/api-interface';
import { HttpClient } from '@angular/common/http';


@Component({
  selector: 'ea-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  hello$ = this.http.get<Message>('/api/hello');

  constructor(private http: HttpClient) { }
}
