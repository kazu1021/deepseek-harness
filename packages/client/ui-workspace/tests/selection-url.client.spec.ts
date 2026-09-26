import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { readSelectionFromUrl, writeSelectionToUrl } from '../src/client/selection-url.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Stubs the browser location and records the history replacements written to it. */
function stubLocation(href: string): string[] {
  const url = new URL(href)
  const written: string[] = []
  vi.stubGlobal('location', { href: url.href, search: url.search, pathname: url.pathname, hash: url.hash })
  vi.stubGlobal('history', {
    replaceState: (_state: unknown, _unused: string, target: string) => { written.push(target) },
  })
  return written
}

describe('readSelectionFromUrl', () => {
  it.each([
    ['http://127.0.0.1:3080/', undefined],
    ['http://127.0.0.1:3080/?token=abc', undefined],
    ['http://127.0.0.1:3080/?session=', undefined],
  ])('reads no selection from %s', (href, expected) => {
    stubLocation(href)
    expect(readSelectionFromUrl()).toEqual(expected)
  })

  it('reads the named Session', () => {
    stubLocation('http://127.0.0.1:3080/?session=session-a')
    expect(readSelectionFromUrl()).toEqual({ sessionId: SessionId('session-a') })
  })

  it('reads a subagent address as its child and parent ids with an unresolved mode', () => {
    stubLocation('http://127.0.0.1:3080/?session=session-child&parent=session-parent')
    expect(readSelectionFromUrl()).toEqual({
      sessionId: SessionId('session-child'),
      subagentAddress: {
        parentSessionId: SessionId('session-parent'),
        childSessionId: SessionId('session-child'),
        mode: 'unknown',
      },
    })
  })

  it('reads no selection where there is no location', () => {
    vi.stubGlobal('location', undefined)
    expect(readSelectionFromUrl()).toBeUndefined()
  })
})

describe('writeSelectionToUrl', () => {
  it('records the Session while keeping other parameters and the fragment', () => {
    const written = stubLocation('http://127.0.0.1:3080/?token=abc#panel')

    writeSelectionToUrl({ sessionId: SessionId('session-a') })

    expect(written).toEqual(['/?token=abc&session=session-a#panel'])
  })

  it('records a subagent address as child and parent ids', () => {
    const written = stubLocation('http://127.0.0.1:3080/')

    writeSelectionToUrl({
      sessionId: SessionId('session-child'),
      subagentAddress: {
        parentSessionId: SessionId('session-parent'),
        childSessionId: SessionId('session-child'),
        mode: 'continuable',
      },
    })

    expect(written).toEqual(['/?session=session-child&parent=session-parent'])
  })

  it('drops a parent left over from a subagent address', () => {
    const written = stubLocation('http://127.0.0.1:3080/?session=session-child&parent=session-parent')

    writeSelectionToUrl({ sessionId: SessionId('session-main') })

    expect(written).toEqual(['/?session=session-main'])
  })

  it('drops both keys for a cleared selection', () => {
    const written = stubLocation('http://127.0.0.1:3080/?token=abc&session=session-child&parent=session-parent')

    writeSelectionToUrl(undefined)

    expect(written).toEqual(['/?token=abc'])
  })

  it('writes nothing where there is no location', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('location', undefined)
    vi.stubGlobal('history', { replaceState })

    writeSelectionToUrl({ sessionId: SessionId('session-a') })

    expect(replaceState).not.toHaveBeenCalled()
  })
})
