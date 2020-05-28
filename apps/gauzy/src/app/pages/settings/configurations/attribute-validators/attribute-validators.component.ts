import { Component, OnInit } from '@angular/core';
import { AttributeValidatorsService } from '../../../../@core/services/attribute-validators.service';
import { AttributeValidator } from '@gauzy/models';



@Component({
  selector: 'ga-attribute-validators',
  templateUrl: './attribute-validators.component.html'
})
export class AttributeValidatorsComponent implements OnInit
{

  public attributeValidators: AttributeValidator[];

  public constructor( private attributeValidatorsService: AttributeValidatorsService )
  {
  }

  public async ngOnInit()
  {
    this.attributeValidators = await this.attributeValidatorsService.getAll();
  }

}
