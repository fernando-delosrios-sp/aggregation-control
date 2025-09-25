export type SourceConfig = {
    name: string
    percentage: number
}

export interface Config {
    spConnectorInstanceId: string
    spConnectorSpecId: string
    spConnectorSupportsCustomSchemas: boolean
    isc_baseurl: string
    isc_clientId: string
    isc_clientSecret: string
    nerm_baseurl: string
    nerm_token: string
    nerm_admin: string
    sources?: SourceConfig[]
}
