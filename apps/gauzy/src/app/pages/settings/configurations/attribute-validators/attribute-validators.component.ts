import { Component, OnInit } from '@angular/core';
import { AttributeValidatorsService } from '../../../../@core/services/attribute-validators.service';
import { AttributeValidator, AttributeValidatorCreateInput } from '@gauzy/models';
import { filter } from 'async';



@Component({
  selector: 'ga-attribute-validators',
  templateUrl: './attribute-validators.component.html'
})
export class AttributeValidatorsComponent implements OnInit
{

  public attributeValidators: AttributeValidator[];

  public current: AttributeValidator;

  public reference: string;

  public readonly monacoEditorConfig = {
    language: 'javascript',
    minimap: {
      enabled: false,
    },
  };

  private throttle: Record<string, any> = {};

  public constructor( private attributeValidatorsService: AttributeValidatorsService )
  {
  }

  public async ngOnInit()
  {
    const validators: Record<string, Omit<AttributeValidatorCreateInput, 'reference'>> = {
      'type:string': {
        parameters: [ 'value' ],
        description: 'Is string',
        script: 'return "string" === typeof value || value instanceof String',
      },
      'type:number': {
        parameters: [ 'value' ],
        description: 'Is number',
        script: 'return value == +value',
      },
      'type:integer': {
        parameters: [ 'value' ],
        description: 'Is integer',
        script: 'return value == +value && 0 === +value % 1',
      },
      'lower:than': {
        parameters: [ 'value' ],
        description: 'Is lower than',
        script: 'return +value < this.conf',
      },
      'greater:than': {
        parameters: [ 'value' ],
        description: 'Is greater than',
        script: 'return +value > this.conf',
      },
      'lower:than-or-equal': {
        parameters: [ 'value' ],
        script: 'return +value <= this.conf',
        description: 'Is lower than or equal',
      },
      'greater:than-or-equal': {
        parameters: [ 'value' ],
        description: 'Is greater or equal',
        script: 'return +value >= this.conf',
      },
    };

    Object
      .keys( validators )
      .forEach( key => this.attributeValidatorsService.find( key )
          .catch( () => this.attributeValidatorsService.create({ ...validators[ key ] as any, reference: key }) ) );

    this.attributeValidators = await this.attributeValidatorsService.find();
  }

  public toggleCollapse( isCollapsed: boolean, value: AttributeValidator ) {
    this.current = isCollapsed ? void 0 : value;
  }

  public filterByReference() {
    const _reference = this.reference;

    clearTimeout( this.throttle.filterByReference );
    this.throttle.filterByReference = setTimeout( async () => {
      this.attributeValidators = await this.attributeValidatorsService.find();

      if ( _reference ) {
        this.attributeValidators = this.attributeValidators
          // FIXME after backend implementation
          .filter( ({ reference }) => 0 <= reference.indexOf( _reference ) );
      }
    }, 500 );
  }
}
