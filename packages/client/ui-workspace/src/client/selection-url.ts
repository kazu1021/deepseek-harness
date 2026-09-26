/** Session selection in the browser URL, as a per-tab alternative to the shared localStorage record. */

import type { SubagentAddress } from '@deepseek-ai/dsh-subagent/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'

/** Query key naming the displayed Session. */
const SESSION_KEY = 'session'
/** Query key naming the direct parent of a subagent Session; absent for a main-view Session. */
const PARENT_KEY = 'parent'

/** The selection a URL names, or undefined when it names none or the URL is not readable. */
export interface UrlSelection {
  /** The displayed Session. */
  readonly sessionId: SessionId
  /** Direct-parent browsing address; absent for a main-view Session. */
  readonly subagentAddress?: SubagentAddress
}

/** A selection whose Session may be absent, as the stored record and a cleared selection are. */
export interface OptionalUrlSelection {
  /** The displayed Session; absent clears the URL's keys. */
  readonly sessionId?: SessionId
  /** Direct-parent browsing address; absent for a main-view Session. */
  readonly subagentAddress?: SubagentAddress
}

/**
 * The Session named by the current location.
 *
 * The stored localSelection record is one slot shared by every tab of the
 * origin, so a tab that reloads after another tab switched Sessions opens that
 * other Session. The URL is per-tab, so a `?session=` naming wins over the
 * stored record and a reload returns to the Session this tab was showing.
 *
 * A subagent address is stored as its child plus parent ids; the mode is left
 * `unknown` because the durable address resolves its mode when child history
 * is read.
 *
 * @returns the named selection, or undefined when the URL names no Session or
 * runs where there is no location (node e2e booting the client tree).
 */
export function readSelectionFromUrl(): UrlSelection | undefined {
  if (typeof location === 'undefined') return undefined
  const params = new URLSearchParams(location.search)
  const session = params.get(SESSION_KEY)
  if (session === null || session === '') return undefined
  const parent = params.get(PARENT_KEY)
  if (parent === null || parent === '') return { sessionId: SessionId(session) }
  return {
    sessionId: SessionId(session),
    subagentAddress: {
      parentSessionId: SessionId(parent),
      childSessionId: SessionId(session),
      mode: 'unknown',
    },
  }
}

/**
 * Record the displayed Session in the URL, replacing the history entry so the
 * back button does not walk a Session trail. Other query parameters (the
 * Web authentication token among them) and the fragment are preserved, and
 * every other origin query stays untouched.
 *
 * @param selection - the displayed Session; an empty one drops the keys so a
 * fresh tab opens the stored record instead of a dead Session.
 */
export function writeSelectionToUrl(selection: OptionalUrlSelection | undefined): void {
  if (typeof location === 'undefined' || typeof history === 'undefined') return
  const url = new URL(location.href)
  if (selection?.sessionId === undefined) {
    url.searchParams.delete(SESSION_KEY)
    url.searchParams.delete(PARENT_KEY)
  } else {
    url.searchParams.set(SESSION_KEY, selection.sessionId)
    const parent = selection.subagentAddress?.parentSessionId
    if (parent === undefined) url.searchParams.delete(PARENT_KEY)
    else url.searchParams.set(PARENT_KEY, parent)
  }
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}
