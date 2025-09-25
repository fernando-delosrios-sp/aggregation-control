import {
    Account,
    AccountsApi,
    AccountsApiListAccountsRequest,
    Configuration,
    ConfigurationParameters, LoadAccountsTaskV2025,
    Paginator,
    PublicIdentitiesConfigApi,
    PublicIdentityConfig,
    ResourceObjectsRequestV2025,
    ResourceObjectsResponseV2025, SourcesApi, SourcesV2025Api,
    SourcesV2025ApiImportAccountsRequest,
    SourcesV2025ApiSearchResourceObjectsRequest
} from 'sailpoint-api-client'
import { TOKEN_URL_PATH } from './data/constants'
import axios from 'axios'
import axiosThrottle from 'axios-request-throttle'
import { retriesConfig, throttleConfig } from './axios'
import { Config } from './model/config'

export class ISCClient {
    private config: Configuration

    constructor(config: Config) {
        const conf: ConfigurationParameters = {
            baseurl: config.isc_baseurl,
            clientId: config.isc_clientId,
            clientSecret: config.isc_clientSecret,
            tokenUrl: new URL(config.isc_baseurl).origin + TOKEN_URL_PATH,
        }
        this.config = new Configuration(conf)
        this.config.retriesConfig = retriesConfig
        this.config.experimental = true
        axiosThrottle.use(axios, throttleConfig)
    }

    async getPublicIdentityConfig(): Promise<PublicIdentityConfig> {
        const api = new PublicIdentitiesConfigApi(this.config)

        const response = await api.getPublicIdentityConfig()

        return response.data
    }

    async listSources() {
        const api = new SourcesApi(this.config)

        const response = await Paginator.paginate(api, api.listSources)

        return response.data
    }

    async peekObjects(sourceId: string, objectType: string, maxCount: number): Promise<ResourceObjectsResponseV2025> {
        const api = new SourcesV2025Api(this.config)
        const resourceObjectsRequestV2025: ResourceObjectsRequestV2025 = {
            objectType,
            maxCount,
        }
        const requestParameters: SourcesV2025ApiSearchResourceObjectsRequest = {
            sourceId,
            resourceObjectsRequestV2025,
        }
        const response = await api.searchResourceObjects(requestParameters)
        return response.data
    }

    async listAccounts(sourceId: string): Promise<Account[]> {
        const api = new AccountsApi(this.config)
        const requestParameters: AccountsApiListAccountsRequest = {
            filters: "sourceId eq '$sourceId'"
        }
        const response = await api.listAccounts(requestParameters)
        return response.data
    }


    async aggregateAccounts(id: string): Promise<LoadAccountsTaskV2025> {
        const api = new SourcesV2025Api(this.config)
        const requestParameters: SourcesV2025ApiImportAccountsRequest = {
            id
        }
        const response = await api.importAccounts(requestParameters)
        return response.data
    }
}
