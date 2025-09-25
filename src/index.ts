import {
    Attributes,
    ConnectorError,
    createConnector,
    logger,
    readConfig,
    Response, StdAccountListHandler, StdConfigOptionsHandler, StdTestConnectionHandler
} from '@sailpoint/connector-sdk'
import { Config } from './model/config'
import { ISCClient } from './isc-client'
import {
    PROCESSINGWAIT
} from './data/constants'
import { fnLog, opEnd, opStart, toLogString } from './logging'


const accountSnaphot = (attributes: Attributes, schemaAttributes: string[]):string => {
    logger.debug(`accountSnaphot: Creating snapshot for attributes=${toLogString(attributes)}, schemaAttributes=${toLogString(schemaAttributes)}`)
    const snapshot = schemaAttributes.reduce((p, c) => {
        p[c] = attributes?.[c]
        return p
    }, {} as Record<string, any>)
    const result = JSON.stringify(snapshot).replaceAll('[]', 'null')
    logger.debug(`accountSnaphot: Snapshot result=${result}`)
    return result
}

// Connector must be exported as module property named connector
export const connector = async () => {
    logger.info('Connector initialization started')
    const config: Config = await readConfig()
    logger.info(`Connector config loaded: ${toLogString(config)}`)
    const isc = new ISCClient(config)
    logger.info('ISCClient initialized')
    const spConnectorInstanceId = config.spConnectorInstanceId
    logger.debug(`spConnectorInstanceId: ${spConnectorInstanceId}`)

    const send = async <T>(res: Response<T>, output: T) => {
        logger.debug(`send: Sending output=${toLogString(output)}`)
        res.send(output)
    }

    const stdTestConnection: StdTestConnectionHandler = async (context, input, res) => {
        opStart('stdTestConnection', input)
        logger.info(fnLog('stdTestConnection', `Testing connection with input: ${toLogString(input)}`))
        try {
            logger.debug('stdTestConnection: Calling isc.getPublicIdentityConfig()')
            await isc.getPublicIdentityConfig()
            logger.info('stdTestConnection: Connection test successful')
            await send(res, {})
            opEnd('stdTestConnection', {})
        } catch (error) {
            logger.error(`stdTestConnection error=${toLogString(error)}`)
            throw new ConnectorError(error as string)
        }
    }

    const stdAccountList: StdAccountListHandler = async (context, input, res) => {
        opStart('stdAccountList', input)
        logger.info(fnLog('stdAccountList', `Listing accounts with input: ${toLogString(input)}`))
        const interval = setInterval(() => {
            logger.debug('stdAccountList: Sending keepAlive')
            res.keepAlive()
        }, PROCESSINGWAIT)

        try {
            logger.debug('stdAccountList: Fetching sources from ISC')
            const sources = await isc.listSources()
            logger.info(`stdAccountList: Sources fetched: ${toLogString(sources)}`)
            if (config.sources) {
                logger.info(`stdAccountList: Configured sources: ${toLogString(config.sources)}`)
                sourceLoop: for (const source of config.sources) {
                    logger.info(`stdAccountList: Processing source: ${toLogString(source)}`)
                    const sourceObject = sources.find((s) => s.name === source.name)
                    if (sourceObject) {
                        logger.info(`stdAccountList: Found sourceObject: ${toLogString(sourceObject)}`)
                        logger.debug(`stdAccountList: Fetching accounts for source id=${sourceObject.id}`)
                        const accounts = await isc.listAccounts(sourceObject.id!)
                        logger.info(`stdAccountList: Accounts fetched: count=${accounts.length}`)
                        let changes = 0
                        const maxChanges = Math.round(accounts.length * (source.percentage/100))
                        const maxCount = Math.round(accounts.length * (1 + source.percentage/100))
                        const previousCount = accounts.length
                        logger.debug(`stdAccountList: maxChanges=${maxChanges}, maxCount=${maxCount}, previousCount=${previousCount}`)
                        logger.debug(`stdAccountList: Peeking objects for source id=${sourceObject.id}, maxCount=${maxCount}`)
                        const response = await isc.peekObjects(sourceObject.id!, 'account', maxCount)
                        logger.info(`stdAccountList: Peeked objects: objectCount=${response.objectCount}, resourceObjectsCount=${response.resourceObjects?.length}`)

                        const newCount = response.objectCount

                        if (!newCount) {
                            logger.error(`stdAccountList error=No new accounts found for source ${source.name}`)
                        }

                        logger.debug(`stdAccountList: Fetching source schemas for source id=${sourceObject.id}`)
                        const schemas = await isc.listSourceSchemas(sourceObject.id!)
                        logger.debug(`stdAccountList: Schemas fetched: ${toLogString(schemas)}`)
                        const schema = schemas.find((s) => s.name === 'account')
                        let schemaAttributes: string[] = []
                        if (source.all) {
                            schemaAttributes = schema?.attributes?.map((a) => a.name) as string[]
                        } else {
                            schemaAttributes = source.attributes || []
                        }
                        logger.debug(`stdAccountList: schemaAttributes=${toLogString(schemaAttributes)}`)
                        const diffCount = Math.abs(newCount! - previousCount)
                        logger.info(`stdAccountList: diffCount=${diffCount}, newCount=${newCount}, previousCount=${previousCount}`)
                        if (diffCount > maxCount - previousCount) {
                            logger.info(`stdAccountList info=Not aggregating accounts for source ${source.name} because the difference (${diffCount}) is greater than ${source.percentage}%`)
                        } else {
                            logger.debug('stdAccountList: Building accountsMap')
                            const accountsMap = new Map<string, any>()
                            accounts.reduce((p, c) => accountsMap.set(c.nativeIdentity!, c), accountsMap)
                            logger.debug(`stdAccountList: accountsMap size=${accountsMap.size}`)
                            objectsLoop: for (const object of response.resourceObjects!) {
                                logger.debug(`stdAccountList: Processing resourceObject: ${toLogString(object)}`)
                                const previousAccount = accountsMap.get(object.identity!)
                                if (previousAccount) {
                                    logger.debug(`stdAccountList: Found previousAccount for identity=${object.identity!}`)
                                    accountsMap.delete(object.identity!)
                                    const prevSnap = accountSnaphot(previousAccount.attributes as Attributes, schemaAttributes)
                                    const currSnap = accountSnaphot(object.attributes as Attributes, schemaAttributes)
                                    logger.debug(`stdAccountList: Comparing snapshots for identity=${object.identity!}, prevSnap=${prevSnap}, currSnap=${currSnap}`)
                                    if (prevSnap !== currSnap) {
                                        changes++
                                        logger.info(`stdAccountList: Detected change for identity=${object.identity!}, total changes=${changes}`)
                                    }
                                } else {
                                    changes++
                                    logger.info(`stdAccountList: New account detected for identity=${object.identity!}, total changes=${changes}`)
                                }
                                if (changes > maxChanges) {
                                    logger.info(`stdAccountList info=Not aggregating accounts for source ${source.name} because the number of changes (${changes}) is greater than ${source.percentage}%`)
                                    break sourceLoop
                                }
                            }

                            logger.info(`stdAccountList: Final changes=${changes}, remaining accounts in map=${accountsMap.size}, maxChanges=${maxChanges}`)
                            if (changes + accountsMap.size > maxChanges) {
                                logger.info(`stdAccountList info=Not aggregating accounts for source ${source.name} because the number of changes (${changes + accountsMap.size}) is greater than ${source.percentage}%`)
                            } else {
                                logger.info(`stdAccountList: Aggregating accounts for source id=${sourceObject.id}`)
                                await isc.aggregateAccounts(sourceObject.id!)
                                logger.info(`stdAccountList: Aggregation complete for source id=${sourceObject.id}`)
                            }
                        }
                    } else {
                        logger.warn(`stdAccountList: Source object not found for source name=${source.name}`)
                    }
                }
            } else {
                logger.warn('stdAccountList: No sources configured in config.sources')
            }
        } catch (error) {
            logger.error(`stdAccountList error=${toLogString(error)}`)
        } finally {
            clearInterval(interval)
            logger.info('stdAccountList: Cleared keepAlive interval')
            opEnd('stdAccountList', 'stream')
        }
    }

    const stdConfigOptions: StdConfigOptionsHandler = async (context, input, res) => {
        opStart('stdConfigOptions', input)
        logger.info(fnLog('stdConfigOptions', `Getting config options with input: ${toLogString(input)}`))
        // send(res, {})
        opEnd('stdConfigOptions', {})
    }

    logger.info('Connector initialization complete, returning connector instance')
    return createConnector()
        .stdTestConnection(stdTestConnection)
        .stdAccountList(stdAccountList)
        .stdConfigOptions(stdConfigOptions)
}
