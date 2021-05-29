export class ServerSourceConf {

    protected static readonly SORT_FIELD_KEY = 'orderBy';
    protected static readonly SORT_DIR_KEY = 'order';
    protected static readonly PAGER_PAGE_KEY = 'page';
    protected static readonly PAGER_LIMIT_KEY = 'limit';
    protected static readonly FILTER_FIELD_KEY = 'filters';
    protected static readonly TOTAL_KEY = 'total';
    protected static readonly DATA_KEY = 'items';

    endPoint: string;

    sortFieldKey: string;
    sortDirKey: string;
    pagerPageKey: string;
    pagerLimitKey: string;
    filterFieldKey: string;
    totalKey: string;
    dataKey: string;
    where: any;
    join: any;
    relations: string[];
    resultMap: any;
    finalize: any;

    constructor({
        resultMap = null,
        finalize = null,
        endPoint = '',
        sortFieldKey = '',
        sortDirKey = '',
        pagerPageKey = '',
        pagerLimitKey = '',
        filterFieldKey = '',
        totalKey = '',
        dataKey = '',
        where = '',
        join = '',
        relations = []
    } = {}) {

        this.endPoint = endPoint ? endPoint : '';

        this.sortFieldKey = sortFieldKey ? sortFieldKey : ServerSourceConf.SORT_FIELD_KEY;
        this.sortDirKey = sortDirKey ? sortDirKey : ServerSourceConf.SORT_DIR_KEY;
        this.pagerPageKey = pagerPageKey ? pagerPageKey : ServerSourceConf.PAGER_PAGE_KEY;
        this.pagerLimitKey = pagerLimitKey ? pagerLimitKey : ServerSourceConf.PAGER_LIMIT_KEY;
        this.filterFieldKey = filterFieldKey ? filterFieldKey : ServerSourceConf.FILTER_FIELD_KEY;
        this.totalKey = totalKey ? totalKey : ServerSourceConf.TOTAL_KEY;
        this.dataKey = dataKey ? dataKey : ServerSourceConf.DATA_KEY;
        this.where = where;
        this.join = join;
        this.relations = relations;
        this.resultMap = resultMap;
        this.finalize = finalize;
    }
}