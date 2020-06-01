import { Component, OnInit } from '@angular/core';
import { AttributeValidatorsService } from '../../../../@core/services/attribute-validators.service';
import { AttributeValidator, AttributeValidatorCreateInput } from '@gauzy/models';



@Component({
  selector: 'ga-attribute-validators',
  templateUrl: './attribute-validators.component.html'
})
export class AttributeValidatorsComponent implements OnInit
{

  public entries: AttributeValidator[];

  public current: AttributeValidator;

  public reference: string;

  public readonly monacoEditorConfig = {
    language: 'javascript',
    theme: 'vs-dark',
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
        description: 'Is string',
        script: 'return "string" === typeof value || value instanceof String',
      },
      'type:number': {
        description: 'Is number',
        script: 'return value == +value',
      },
      'type:integer': {
        description: 'Is integer',
        script: 'return value == +value && 0 === +value % 1',
      },
      'lower:than': {
        description: 'Is lower than',
        script: 'return +value < this.conf',
      },
      'greater:than': {
        description: 'Is greater than',
        script: 'return +value > this.conf',
      },
      'lower:than-or-equal': {
        script: 'return +value <= this.conf',
        description: 'Is lower than or equal',
      },
      'greater:than-or-equal': {
        description: 'Is greater or equal',
        script: 'return +value >= this.conf',
      },
    };

    await Promise.all( Object.keys( validators )
      .map( key => ({ reference: key, ...validators[ key ] }) )
      .map( validator => this.attributeValidatorsService.findByReference( validator.reference )
        .then( ({ length }) => 0 === length && this.attributeValidatorsService.create( validator ) ) ) );

    this.entries = await this.attributeValidatorsService.find();
  }

  public toggleCollapse( isCollapsed: boolean, value: AttributeValidator ) {
    this.current = isCollapsed ? void 0 : value;
  }

  public filterByReference() {
    const _reference = this.reference || '';

    clearTimeout( this.throttle.filterByReference );
    this.throttle.filterByReference = setTimeout( async () => {
      this.entries = await this.attributeValidatorsService.findByReference( _reference );
    }, 500 );
  }

  public update() {
    if ( !this.current ) return ;

    const { current, current: { id } } = this;

    clearTimeout( this.throttle.update );
    this.throttle.update = setTimeout( () =>
      this.attributeValidatorsService.update( id, current ), 700 );
  }
}
