import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
    createBasicAuthConfig,
    isAuthorizedRequest,
    parseAuthorizationHeader,
} from './basicAuth.js'

test('basic auth defaults enabled in production', () => {
    const config = createBasicAuthConfig({ NODE_ENV: 'production' })
    assert.equal(config.enabled, true)
    assert.equal(config.username, 'admin')
    assert.equal(config.password, 'change-me')
})

test('basic auth defaults disabled outside production', () => {
    const config = createBasicAuthConfig({ NODE_ENV: 'development' })
    assert.equal(config.enabled, false)
})

test('basic auth can be explicitly enabled/disabled', () => {
    assert.equal(createBasicAuthConfig({ BASIC_AUTH_ENABLED: 'true' }).enabled, true)
    assert.equal(createBasicAuthConfig({ BASIC_AUTH_ENABLED: 'false' }).enabled, false)
})

test('parse authorization header and authorize request', () => {
    const config = createBasicAuthConfig({ BASIC_AUTH_ENABLED: 'true', BASIC_AUTH_USER: 'host', BASIC_AUTH_PASS: 'pass123' })
    const token = Buffer.from('host:pass123').toString('base64')
    const parsed = parseAuthorizationHeader(`Basic ${token}`)
    assert.deepEqual(parsed, { username: 'host', password: 'pass123' })

    const okReq = { headers: { authorization: `Basic ${token}` } }
    const badReq = { headers: { authorization: `Basic ${Buffer.from('host:wrong').toString('base64')}` } }
    assert.equal(isAuthorizedRequest(okReq, config), true)
    assert.equal(isAuthorizedRequest(badReq, config), false)
})
