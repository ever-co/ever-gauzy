import { Type } from '@angular/core';



export interface SmartTableSettings
{

  /**
   * Default: false
   */
  hideHeader?: boolean;
  /**
   * Default: "No data found"
   */
  noDataMessage?: string;
  /**
   * Default: false
   */
  hideSubHeader?: boolean;
  /**
   * Default: row
   */
  rowClassFunction?: Function;
  /**
   * Default: "inline"
   */
  mode?: 'inline' | 'external';
  /**
   * Default: -
   */
  add?: {
    /**
     * Default: ""
     */
    inputClass?: string;
    /**
     * Default: false
     */
    confirmCreate?: boolean;
    /**
     * Default: "Add New"
     */
    addButtonContent?: string;
    /**
     * Default: "Create"
     */
    createButtonContent?: string;
    /**
     * Default: "Cancel"
     */
    cancelButtonContent?: string;
  };
  /**
   * Default:
   */
  edit?: {
    /**
     * Default: ""
     */
    inputClass?: string;
    /**
     * Default: false
     */
    confirmSave?: boolean;
    /**
     * Default: "Edit"
     */
    editButtonContent?: string;
    /**
     * Default: "Update"
     */
    saveButtonContent?: string;
    /**
     * Default: "Cancel"
     */
    cancelButtonContent?: string;
  };
  /**
   * Default: true
   */
  attr?: {
    /**
     * Default: ""
     */
    id?: string;
    /**
     * Default: ""
     */
    class?: string;
  };
  /**
   * Default: -
   */
  pager?: {
    /**
     * Default: 10
     */
    perPage: number;
    /**
     * Default: true
     */
    display: boolean;
  };
  /**
   * Default: -
   */
  delete?: {
    /**
     * Default: false
     */
    confirmDelete?: boolean;
    /**
     * Default: "Content"
     */
    deleteButtonContent?: string;
  };
  /**
   * Default: -
   */
  actions?: boolean | {
    add?: boolean;
    edit?: boolean;
    delete?: boolean;
    columnTitle?: string;
    position?: 'left' | 'right';
  };
  /**
   * Default: -
   */
  columns?: Record<string, {
    /**
     * Default: ""
     */
    title?: string;
    /**
     * Default: ""
     */
    class?: string;
    /**
     * Default: ""
     */
    width?: string;
    /**
     * Default: true
     */
    sort?: boolean;
    /**
     * Default: true
     */
    editable?: boolean;
    /**
     * Default:
     */
    editor?: boolean | {
      /**
       * Default: "text"
       */
      type?: 'text' | 'textarea' | 'completer' | 'list' | 'checkbox'
      /**
       * Default:
       */
      config?: {
        /**
         * Default: ""
         */
        true?: string;
        /**
         * Default: ""
         */
        false?: string;
        /**
         * Default: []
         */
        list?: {
          value: string;
          title: string;
        }[];
        /**
         * Default: []
         */
        completer?: false | {
          data?: any[];
        };
        /**
         * Default: ""
         */
        titleField?: string;
        /**
         * Default: ""
         */
        searchFields?: string;
        /**
         * Default: ""
         */
        descriptionField?: string;
      };
    };
    /**
     * Default:
     */
    filter?: boolean | {
      /**
       * Default: -
       */
      resetText: string;
      /**
       * Default: "select"
       */
      type?: 'select' | 'checkbox' | 'completer';
      /**
       * Default:
       */
      config?: Exclude<SmartTableSettings[ 'columns' ][ any ][ 'editor' ], boolean>[ 'config' ];

    };
    /**
     * Default: -
     */
    compareFunction?: Function;
    /**
     * Default: null
     */
    renderComponent?: Type<any>;
    /**
     * Default: -
     */
    sortDirection?: 'asc' | 'desc';
    /**
     * Default: -
     */
    valuePrepareFunction?: Function;
    /**
     * Default: "text"
     */
    type?: 'text' | 'html' | 'custom';
    /**
     * Default: null
     */
    onComponentInitFunction?: Function;
  }>;
  /**
   * Default: true
   */
  filter?: boolean | {
    /**
     * Default: ""
     */
    inputClass?: string;
  };

}
