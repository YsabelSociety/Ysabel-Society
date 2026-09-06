export const WEBSITE_SOURCE = {
  propertyId: '552874533',
  streamId: '15726284662',
  measurementId: 'G-WDV71MP0DK',
  website: 'https://ysabelsociety.com',
  hostnames: ['ysabelsociety.com', 'www.ysabelsociety.com'],
};
export const websiteStreamFilter = {
  filter: {
    fieldName: 'streamId',
    stringFilter: { matchType: 'EXACT', value: WEBSITE_SOURCE.streamId },
  },
};
export function websiteReportFilter(extra?: unknown) {
  return {
    andGroup: {
      expressions: [
        websiteStreamFilter,
        {
          filter: {
            fieldName: 'hostName',
            inListFilter: {
              values: WEBSITE_SOURCE.hostnames,
              caseSensitive: false,
            },
          },
        },
        {
          notExpression: {
            filter: {
              fieldName: 'pagePath',
              stringFilter: {
                matchType: 'BEGINS_WITH',
                value: '/marketingdata',
              },
            },
          },
        },
        ...(extra ? [extra] : []),
      ],
    },
  };
}
