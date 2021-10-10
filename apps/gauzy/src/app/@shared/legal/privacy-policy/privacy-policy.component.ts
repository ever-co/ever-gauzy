import { Component, OnDestroy, OnInit } from '@angular/core';
import { LegalService } from '../legal.service';

@Component({
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss'],
})

export class PrivacyPolicyComponent implements OnInit, OnDestroy {
  data: any;
  constructor(
    private legalService : LegalService
  ){}

  ngOnDestroy() { }

  getJsonFromUrl(url: string) {
    this.legalService.getJsonFromUrl(url).subscribe(resp => {
      if(!!resp.content){
        this.data = resp.content;
      }
    })
  }

  ngOnInit(): void {
    this.getJsonFromUrl('https://www.iubenda.com/api/privacy-policy/18120170');
  }
}
