/**
 * @typedef {import('xast').Root} Root
 */

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import process from 'node:process'
import test from 'node:test'
import {isHidden} from 'is-hidden'
import {fromXml} from '../index.js'

test('fromXml', async function (t) {
  await t.test('should expose the public api', async function () {
    assert.deepEqual(Object.keys(await import('../index.js')).sort(), [
      'fromXml'
    ])
  })

  await t.test('should throw messages', async function () {
    try {
      fromXml('<root unquoted=attribute>')
      assert.fail()
    } catch (error) {
      assert.match(String(error), /^1:16: Attribute value expected/)
    }
  })

  await t.test('should throw for SGML directives', async function () {
    try {
      fromXml('<!ENTITY>')
      assert.fail()
    } catch (error) {
      assert.match(String(error), /^1:1: Root element is missing or invalid/)
    }
  })

  await t.test('should throw for unknown entities (1)', async function () {
    try {
      fromXml('<root>&foo;</root>')
      assert.fail()
    } catch (error) {
      assert.match(String(error), /^1:7: Named entity isn't defined/)
    }
  })

  await t.test('should throw for unknown entities (2)', async function () {
    try {
      fromXml('<root>&copy;</root>')
      assert.fail()
    } catch (error) {
      assert.match(String(error), /^1:7: Named entity isn't defined/)
    }
  })

  await t.test('should throw on invalid nesting', async function () {
    try {
      fromXml('<root><a><b><c/></a></b></root>')
      assert.fail()
    } catch (error) {
      assert.match(String(error), /^1:17: Missing end tag for element/)
    }
  })
})

test('fixtures', async function (t) {
  const base = new URL('fixtures/', import.meta.url)
  const files = await fs.readdir(base)
  let index = -1

  while (++index < files.length) {
    const folder = files[index]

    if (isHidden(folder)) continue

    await t.test(folder, async function () {
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
        await fs.writeFile(treeUrl, JSON.stringify(actual, undefined, 2) + '\n')
        return
      }

      assert.deepEqual(actual, expected)
    })
  }
})
