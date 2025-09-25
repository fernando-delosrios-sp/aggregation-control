import {
    ConnectorError,
    createConnector,
    logger,
    readConfig,
    Response, StdAccountListHandler, StdTestConnectionHandler
} from '@sailpoint/connector-sdk'
import { Config } from './model/config'
import { ISCClient } from './isc-client'
import {
    PROCESSINGWAIT
} from './data/constants'
import { fnLog, opEnd, opStart, toLogString } from './logging'

// Connector must be exported as module property named connector
export const connector = async () => {
    const config: Config = await readConfig()
    const isc = new ISCClient(config)
    const spConnectorInstanceId = config.spConnectorInstanceId

    const send = async <T>(res: Response<T>, output: T) => {
        logger.debug(`send output=${toLogString(output)}`)
        res.send(output)
    }

    const stdTestConnection: StdTestConnectionHandler = async (context, input, res) => {
        opStart('stdTestConnection', input)
        logger.debug(fnLog('stdTestConnection', 'Testing connection'))
        try {
            await isc.getPublicIdentityConfig()

            send(res, {})
            opEnd('stdTestConnection', {})
        } catch (error) {
            logger.error(`stdTestConnection error=${toLogString(error)}`)
            throw new ConnectorError(error as string)
        }
    }

    const stdAccountList: StdAccountListHandler = async (context, input, res) => {
        opStart('stdAccountList', input)
        logger.debug(fnLog('stdAccountList', 'Listing accounts'))
        const interval = setInterval(() => {
            res.keepAlive()
        }, PROCESSINGWAIT)

        try {
            const sources = await isc.listSources()
           if (config.sources) {
            sources: for (const source of config.sources) {
                const sourceObject = sources.find((s) => s.name === source.name)
                if (sourceObject) {
                    const accounts = await isc.listAccounts(sourceObject.id!)
                    let changes = 0
                    const maxChanges = Math.round(accounts.length * (source.percentage/100))
                    const previousCount = accounts.length
                    const response = await isc.peekObjects(sourceObject.id!, 'account', accounts.length * (1 + source.percentage/100))
                    const newCount = response.objectCount

                    if (!newCount) {
                        logger.error(`stdAccountList error=No new accounts found for source ${source.name}`)
                    }

                    const diffCount = Math.abs(newCount! - previousCount)
                    if (diffCount > previousCount * (source.percentage/100)) {
                        logger.info(`stdAccountList info=Not aggregating accounts for source ${source.name} because the difference is greater than ${source.percentage}%`)
                    } else {
                        const accountsMap = new Map<string, any>()
                        accounts.reduce((p, c) => accountsMap.set(c.nativeIdentity!, c), accountsMap)
                        objects: for (const object of response.resourceObjects!) {
                            const account = accountsMap.get(object.identity!)
                            if (account) {
                                accountsMap.delete(object.identity!)
                                const previousAttributes = JSON.stringify(account.attributes)
                                const newAttributes = JSON.stringify(object.attributes)
                                if (previousAttributes !== newAttributes) {
                                    logger.info(`stdAccountList info=Account ${object.identity!} has changed`)
                                    changes++
                                }
                            } else {
                                changes++
                            }
                            if (changes > maxChanges) {
                                logger.info(`stdAccountList info=Not aggregating accounts for source ${source.name} because the number of changes is greater than ${source.percentage}%`)
                                break sources
                            }
                        }

                        if (changes + accountsMap.size > maxChanges) {
                            logger.info(`stdAccountList info=Not aggregating accounts for source ${source.name} because the number of changes is greater than ${source.percentage}%`)
                        } else {
                            await isc.aggregateAccounts(sourceObject.id!)
                        }
                    }
                }
            }
           }
        } catch (error) {
            logger.error(`stdAccountList error=${toLogString(error)}`)
        } finally {
            clearInterval(interval)
            opEnd('stdAccountList', 'stream')
        }
    }

    return createConnector()
        .stdTestConnection(stdTestConnection)
        .stdAccountList(stdAccountList)
}
