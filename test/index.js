/**
 * @typedef {import('xast').Root} Root
 */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import process from 'node:process'
import test from 'node:test'
import {isHidden} from 'is-hidden'
import {fromXml} from '../index.js'
import * as mod from '../index.js'

test('fromXml', () => {
  assert.deepEqual(
    Object.keys(mod).sort(),
    ['fromXml'],
    'should expose the public api'
  )

  try {
    fromXml('<root unquoted=attribute>')
    assert.fail('should fail (1)')
  } catch (error) {
    assert.equal(
      String(error),
      '1:17: Unquoted attribute value',
      'should throw messages'
    )
  }

  try {
    fromXml('<!ENTITY>')
    assert.fail('should fail (2)')
  } catch (error) {
    assert.equal(
      String(error),
      '1:10: Unexpected SGML declaration',
      'should throw for SGML directives'
    )
  }

  try {
    fromXml('<root>&foo;</root>')
    assert.fail('should fail (3)')
  } catch (error) {
    assert.equal(
      String(error),
      '1:12: Invalid character entity',
      'should throw for unknown entities (1)'
    )
  }

  try {
    fromXml('<root>&copy;</root>')
    assert.fail('should fail (4)')
  } catch (error) {
    assert.equal(
      String(error),
      '1:13: Invalid character entity',
      'should throw for unknown entities (2)'
    )
  }

  try {
    fromXml('<root><a><b><c/></a></b></root>')
    assert.fail('should fail (5)')
  } catch (error) {
    assert.equal(
      String(error),
      '1:21: Unexpected close tag',
      'should throw on invalid nesting'
    )
  }

  assert.throws(
    () => {
      fromXml('<!doctype>')
    },
    /1:11: Expected doctype name/,
    'should throw on missing doctype name'
  )

  assert.throws(
    () => {
      fromXml('<!doctype !>')
    },
    /1:13: Expected start of doctype name/,
    'should throw on invalid doctype name'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name[<!ELEMENT greeting (#PCDATA)>]>')
    },
    /1:47: Unexpected internal subset/,
    'should throw on internal subset directly after doctype name'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name [<!ELEMENT greeting (#PCDATA)>]>')
    },
    /1:48: Unexpected internal subset/,
    'should throw on internal subset after doctype name'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name!>')
    },
    /1:17: Expected doctype name character, whitespace, or doctype end/,
    'should throw on invalid character directly after doctype'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name !>')
    },
    /1:18: Expected external identifier \(`PUBLIC` or `SYSTEM`\), whitespace, or doctype end/,
    'should throw on invalid character after doctype'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name PUB>')
    },
    /1:20: Expected external identifier \(`PUBLIC` or `SYSTEM`\)/,
    'should throw on invalid external identifier (1)'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name SYSTEm>')
    },
    /1:23: Expected external identifier \(`PUBLIC` or `SYSTEM`\)/,
    'should throw on invalid external identifier (2)'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name PUBLIC>')
    },
    /1:23: Expected whitespace after `PUBLIC`/,
    'should throw on missing whitespace after public identifier'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name PUBLIC !>')
    },
    /1:25: Expected quote or apostrophe to start public literal/,
    'should throw on invalid character after public identifier'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name PUBLIC "🤔">')
    },
    /1:28: Expected pubid character in public literal/,
    'should throw on invalid character in public identifier'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name PUBLIC "literal"!>')
    },
    /1:34: Expected whitespace after public literal/,
    'should throw on invalid character after public literal'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name SYSTEM>')
    },
    /1:23: Expected whitespace after `SYSTEM`/,
    'should throw on missing whitespace after system identifier'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name SYSTEM !>')
    },
    /1:25: Expected quote or apostrophe to start system literal/,
    'should throw on invalid character after system identifier'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name SYSTEM "asd>')
    },
    /1:28: Unexpected end/,
    'should throw on unended system literal'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name SYSTEM "asd" [<!ELEMENT greeting (#PCDATA)>]>')
    },
    /1:61: Unexpected internal subset/,
    'should throw on internal subset after external id'
  )

  assert.throws(
    () => {
      fromXml('<!DOCTYPE name SYSTEM "asd" !>')
    },
    /1:31: Expected whitespace or end of doctype/,
    'should throw on unexpected character after external id'
  )
})

test('fixtures', async () => {
  const base = new URL('fixtures/', import.meta.url)
  const files = await fs.readdir(base)
  let index = -1

  while (++index < files.length) {
    const folder = files[index]

    if (isHidden(folder)) continue

    const inputUrl = new URL(folder + '/index.xml', base)
    const treeUrl = new URL(folder + '/index.json', base)
    const input = await fs.readFile(inputUrl)
    const actual = fromXml(input)
    /** @type {Root} */
    let expected

    try {
      expected = JSON.parse(String(await fs.readFile(treeUrl)))

      if ('UPDATE' in process.env) {
        throw new Error('Update')
      }
    } catch {
      // New folder.
      await fs.writeFile(treeUrl, JSON.stringify(actual, null, 2) + '\n')
      continue
    }

    assert.deepEqual(actual, expected, folder)
  }
})
