import { IAxiosRetryConfig } from 'axios-retry'
import { REQUESTSPERSECOND, RETRIES } from './data/constants'
import { logger } from '@sailpoint/connector-sdk'
import { AxiosResponseHeaders } from 'axios'
import axiosRetry from 'axios-retry'

const toLogString = (value: any): string => {
    if (typeof value === 'string') return value
    try {
        return JSON.stringify(value)
    } catch {
        return String(value)
    }
}

export const retriesConfig: IAxiosRetryConfig = {
    retries: RETRIES,
    retryDelay: (retryCount, error) => {
        type NewType = AxiosResponseHeaders

        const headers = error.response!.headers as NewType
        const retryAfter = headers.get('retry-after') as number

        return retryAfter ? retryAfter : 10 * 1000
    },
    retryCondition: (error) => {
        return axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error) || error.response?.status === 429
    },
    onRetry: (retryCount, error, requestConfig) => {
        logger.debug(
            `axios onRetry: Retrying API [${requestConfig.url}] due to request error: [${toLogString(
                error
            )}]. Retry number [${retryCount}]`
        )
        logger.error(`axios onRetry error: ${toLogString(error)}`)
    },
}

export const throttleConfig = { requestsPerSecond: REQUESTSPERSECOND }
