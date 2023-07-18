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
    assert.match(
      String(error),
      /^1:16: Attribute value expected/,
      'should throw messages'
    )
  }

  try {
    fromXml('<!ENTITY>')
    assert.fail('should fail (2)')
  } catch (error) {
    assert.match(
      String(error),
      /^1:1: Root element is missing or invalid/,
      'should throw for SGML directives'
    )
  }

  try {
    fromXml('<root>&foo;</root>')
    assert.fail('should fail (3)')
  } catch (error) {
    assert.match(
      String(error),
      /^1:7: Named entity isn't defined/,
      'should throw for unknown entities (1)'
    )
  }

  try {
    fromXml('<root>&copy;</root>')
    assert.fail('should fail (4)')
  } catch (error) {
    assert.match(
      String(error),
      /^1:7: Named entity isn't defined/,
      'should throw for unknown entities (2)'
    )
  }

  try {
    fromXml('<root><a><b><c/></a></b></root>')
    assert.fail('should fail (5)')
  } catch (error) {
    assert.match(
      String(error),
      /^1:17: Missing end tag for element/,
      'should throw on invalid nesting'
    )
  }
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
    /** @type {Root} */
    // Remove `undefined`s.
    const actual = JSON.parse(JSON.stringify(fromXml(input)))
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
