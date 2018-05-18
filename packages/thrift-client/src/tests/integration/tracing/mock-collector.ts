import * as bodyParser from 'body-parser'
import * as express from 'express'
import * as net from 'net'

import {
    COLLECTOR_CONFIG,
} from './config'

// http://localhost:9411/api/v1/spans

export function serviceName(span: any): string | undefined {
    if (span.annotations && span.annotations.length) {
        if (span.annotations[0].endpoint) {
            return span.annotations[0].endpoint.serviceName
        }
    }
}

export interface IMockCollector {
    server: net.Server
    reset: () => void
    traces: () => any
    close: () => Promise<void>
}

export function createServer(): Promise<IMockCollector> {
    // Get express instance
    const app = express()

    app.use(bodyParser.json())

    let traces: any = {}

    app.post('/api/v1/spans', (req: express.Request, res: express.Response): void => {
        if (req.body && req.body.length) {
            req.body.forEach((next: any) => {
                const traceId = next.traceId
                const id = next.id
                if (traces[traceId] === undefined) {
                    traces[traceId] = {}
                }

                // traces[traceId][id] = next
                traces[traceId][id] = {
                    traceId: next.traceId,
                    id: next.id,
                    parentId: next.parentId,
                    duration: next.duration,
                    serviceName: serviceName(next),
                }
            })
        }

        res.sendStatus(202)
    })

    return new Promise((resolve, reject) => {
        const server: net.Server = app.listen(COLLECTOR_CONFIG.port, (err: any) => {
            if (err) {
                reject(err)

            } else {
                console.log(`MockCollector listening on port[${COLLECTOR_CONFIG.port}]`)
                resolve({
                    server,
                    reset() {
                        traces = {}
                    },
                    traces(): any {
                        const tracesToReturn = traces
                        traces = {}
                        return tracesToReturn
                    },
                    close(): Promise<void> {
                        return new Promise((resolve, reject) => {
                            server.close(() => {
                                console.log('MockCollector closed')
                                server.unref()
                                resolve()
                            })
                        })
                    }
                })
            }
        })
    })
}
