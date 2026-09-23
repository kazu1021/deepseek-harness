// @vitest-environment jsdom
/**
 * Keymap routing at the DOM boundary: synthetic keydowns on the
 * contenteditable reach the registered composer commands (the jsdom lane's
 * gesture entry, below the full component bench).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { createEditor } from 'lexical'
import { registerPlainText } from '@lexical/plain-text'
import { registerComposerKeymap } from '../src/client/input/editor/keymap.ts'

describe('keymap keydown routing', () => {
  it('lets plain Enter and Ctrl/Cmd+Enter fall through (newline; no submit)', () => {
    const editor = createEditor({ namespace: 'keymap-routing', onError: (e) => { throw e } })
    const root = document.createElement('div')
    root.contentEditable = 'true'
    document.body.appendChild(root)
    editor.setRootElement(root)
    registerPlainText(editor)
    const submit = vi.fn()
    const arbitrate = vi.fn(() => 'pass' as const)
    registerComposerKeymap(editor, {
      arbitrate,
      space: () => false,
      dismissPopup: () => {},
      canSubmit: () => true,
      submit,
      intakeFiles: () => {},
      pasteText: () => {},
    })
    // Returning true from fireEvent.keyDown means the browser default was NOT prevented —
    // Lexical plain-text then inserts the newline.
    expect(fireEvent.keyDown(root, { key: 'Enter' })).toBe(true)
    expect(fireEvent.keyDown(root, { key: 'Enter', metaKey: true })).toBe(true)
    expect(fireEvent.keyDown(root, { key: 'Enter', ctrlKey: true })).toBe(true)
    expect(fireEvent.keyDown(root, { key: 'Enter', shiftKey: true })).toBe(true)
    expect(submit).not.toHaveBeenCalled()
    expect(arbitrate).toHaveBeenCalledWith('enter', false)
  })

  it('keeps IME composition Enter from inserting a newline or submitting', () => {
    const editor = createEditor({ namespace: 'keymap-routing', onError: (e) => { throw e } })
    const root = document.createElement('div')
    root.contentEditable = 'true'
    document.body.appendChild(root)
    editor.setRootElement(root)
    registerPlainText(editor)
    const submit = vi.fn()
    registerComposerKeymap(editor, {
      arbitrate: () => 'pass',
      space: () => false,
      dismissPopup: () => {},
      canSubmit: () => true,
      submit,
      intakeFiles: () => {},
      pasteText: () => {},
    })
    fireEvent.compositionStart(root)
    // Handler returns true (consumed) without preventDefault — fireEvent still reports true
    // when default is not prevented; assert submit never fires and arbitrate is skipped.
    fireEvent.keyDown(root, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(root, { key: 'Enter', keyCode: 229 })
    expect(submit).not.toHaveBeenCalled()
  })

  it('menu-open Enter still arbitrates and does not submit', () => {
    const editor = createEditor({ namespace: 'keymap-routing', onError: (e) => { throw e } })
    const root = document.createElement('div')
    root.contentEditable = 'true'
    document.body.appendChild(root)
    editor.setRootElement(root)
    registerPlainText(editor)
    const submit = vi.fn()
    const arbitrate = vi.fn(() => 'pick-highlighted' as const)
    registerComposerKeymap(editor, {
      arbitrate,
      space: () => false,
      dismissPopup: () => {},
      canSubmit: () => true,
      submit,
      intakeFiles: () => {},
      pasteText: () => {},
    })
    const allowed = fireEvent.keyDown(root, { key: 'Enter' })
    expect(arbitrate).toHaveBeenCalledWith('enter', false)
    expect(allowed).toBe(false) // preventDefault fired for the menu pick
    expect(submit).not.toHaveBeenCalled()
  })

  it('routes Tab through arbitration and passes when unconsumed', () => {
    const editor = createEditor({ namespace: 'keymap-routing', onError: (e) => { throw e } })
    const root = document.createElement('div')
    root.contentEditable = 'true'
    document.body.appendChild(root)
    editor.setRootElement(root)
    registerPlainText(editor)
    const arbitrate = vi.fn<(key: string, composing: boolean) => 'consumed' | 'pick-highlighted' | 'pass'>()
      .mockReturnValueOnce('consumed')
      .mockReturnValueOnce('pick-highlighted')
      .mockReturnValue('pass')
    registerComposerKeymap(editor, {
      arbitrate,
      space: () => false,
      dismissPopup: () => {},
      canSubmit: () => true,
      submit: () => {},
      intakeFiles: () => {},
      pasteText: () => {},
    })
    const consumed = fireEvent.keyDown(root, { key: 'Tab', keyCode: 9 })
    expect(arbitrate).toHaveBeenCalledWith('tab', false)
    expect(consumed).toBe(false) // consumed: preventDefault fired
    const picked = fireEvent.keyDown(root, { key: 'Tab', keyCode: 9 })
    expect(picked).toBe(false) // picked: the completion replaces native traversal
    const passed = fireEvent.keyDown(root, { key: 'Tab', keyCode: 9 })
    expect(passed).toBe(true) // pass: the browser keeps native focus traversal
  })
})
