import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, OnInit } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Injectable({
  providedIn: 'root'
})
export class LegalService implements OnInit, OnDestroy {
  constructor(
    private http: HttpClient
  ) {}

  getJsonFromUrl(url: string) {
    return this.http.get<any>(url);
  }

  ngOnDestroy(): void {}
  ngOnInit(): void {}
}
