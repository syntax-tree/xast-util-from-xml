/**
 * @typedef {import('sax').Tag} Tag
 * @typedef {import('unist').Point} Point
 * @typedef {import('xast').Root} Root
 * @typedef {import('xast').Comment} Comment
 * @typedef {import('xast').Text} Text
 * @typedef {import('xast').Doctype} Doctype
 * @typedef {import('xast').RootChildMap} RootChildMap
 */

/**
 * @typedef {RootChildMap[keyof RootChildMap]} Child
 * @typedef {Root | Child} Node
 */

import sax from 'sax'
import {VFileMessage} from 'vfile-message'

const Parser = sax.SAXParser

const fromCharCode = String.fromCharCode

const search = /\r?\n|\r/g

/**
 * Parse a string of XML to a xast tree.
 *
 * @param {string | Uint8Array} value
 *   Serialized XML.
 * @returns {Root}
 *   xast root.
 */
export function fromXml(value) {
  // @ts-expect-error `strictEntities` is most definitely fine.
  const parser = new Parser(true, {position: true, strictEntities: true})
  /** @type {[Root, ...Array<Node>]} */
  const stack = [{type: 'root', children: []}]
  let position = now()

  parser.ondoctype = ondoctype
  parser.onsgmldeclaration = onsgmldeclaration
  parser.onprocessinginstruction = onprocessinginstruction
  parser.ontext = ontext
  parser.oncomment = oncomment
  parser.onopencdata = oncdataopen
  parser.oncdata = oncdatavalue
  parser.onclosecdata = exit
  parser.onopentag = onopen
  parser.onclosetag = exit
  parser.onerror = onerror

  // @ts-expect-error Buffers are most definitely fine.
  parser.write(value).close()

  return stack[0]

  /**
   * Crash on a SAX error.
   *
   * @param {Error} error
   *   Error.
   * @returns {never}
   *   Never.
   */
  function onerror(error) {
    const index = error.message.indexOf('\nLine')
    // The substring should always be included, but this guards against
    // changes in newer sax versions.
    /* c8 ignore next */
    fail(index === -1 ? error.message : error.message.slice(0, index), 'sax')
  }

  /**
   * Crash on an SGML declaration.
   *
   * @returns {never}
   *   Never.
   */
  function onsgmldeclaration() {
    fail('Unexpected SGML declaration', 'unexpected-sgml')
  }

  /**
   * Handle a doctype.
   *
   * @param {string} value
   *   Doctype string.
   * @returns {void}
   *   Nothing.
   */
  // eslint-disable-next-line complexity
  function ondoctype(value) {
    /** @type {Doctype} */
    // @ts-expect-error: `null`s are fine.
    const node = {type: 'doctype', name: '', public: null, system: null}
    let index = -1
    let state = 'BEGIN'
    /** @type {string | undefined} */
    let returnState
    /** @type {string | undefined} */
    let buffer
    /** @type {number | undefined} */
    let bufferIndex
    /** @type {number | undefined} */
    let start
    /** @type {number | undefined} */
    let marker

    while (++index <= value.length) {
      const code =
        index === value.length ? null /* EOF */ : value.charCodeAt(index)

      switch (state) {
        case 'BEGIN': {
          if (isSpace(code)) {
            state = 'BEFORE_NAME'
          } else {
            fail('Expected doctype name', 'doctype-name')
          }

          break
        }

        case 'BEFORE_NAME': {
          if (isSpace(code)) {
            // As expected.
          } else if (isNameStartChar(code)) {
            state = 'IN_NAME'
            start = index
          } else {
            fail('Expected start of doctype name', 'doctype-name')
          }

          break
        }

        case 'IN_NAME': {
          if (isNameChar(code)) {
            // As expected.
          } else if (isSpace(code) || code === null /* EOF */) {
            state = 'AFTER_NAME'
            node.name = value.slice(start, index)
          } else if (code === 91 /* `[` */) {
            fail('Unexpected internal subset', 'doctype-internal-subset')
          } else {
            fail(
              'Expected doctype name character, whitespace, or doctype end',
              'doctype-name'
            )
          }

          break
        }

        case 'AFTER_NAME': {
          if (code === null /* EOF */) {
            // Done.
          } else if (isSpace(code)) {
            // As expected.
          } else
            switch (code) {
              case 80: {
                state = 'IN_EID'
                returnState = 'AFTER_PUBLIC'
                buffer = 'PUBLIC'
                bufferIndex = 0

                break
              }

              case 83: {
                state = 'IN_EID'
                returnState = 'AFTER_SYSTEM'
                buffer = 'SYSTEM'
                bufferIndex = 0

                break
              }

              case 91: {
                fail('Unexpected internal subset', 'doctype-internal-subset')

                break
              }

              default: {
                fail(
                  'Expected external identifier (`PUBLIC` or `SYSTEM`), whitespace, or doctype end',
                  'doctype-external-identifier'
                )
              }
            }

          break
        }

        case 'IN_EID': {
          if (
            returnState &&
            buffer &&
            bufferIndex !== undefined &&
            code === buffer.charCodeAt(++bufferIndex)
          ) {
            if (bufferIndex === buffer.length - 1) {
              state = returnState
            }
          } else {
            fail(
              'Expected external identifier (`PUBLIC` or `SYSTEM`)',
              'doctype-external-identifier'
            )
          }

          break
        }

        case 'AFTER_PUBLIC': {
          if (isSpace(code)) {
            state = 'BEFORE_PUBLIC_LITERAL'
          } else {
            fail('Expected whitespace after `PUBLIC`', 'doctype-public-literal')
          }

          break
        }

        case 'AFTER_SYSTEM': {
          if (isSpace(code)) {
            state = 'BEFORE_SYSTEM_LITERAL'
          } else {
            fail('Expected whitespace after `SYSTEM`', 'doctype-system-literal')
          }

          break
        }

        case 'BEFORE_PUBLIC_LITERAL': {
          if (isSpace(code)) {
            // As expected.
          } else if (code === 34 /* `"` */ || code === 39 /* `'` */) {
            state = 'IN_PUBLIC_LITERAL'
            start = index + 1
            marker = code
          } else {
            fail(
              'Expected quote or apostrophe to start public literal',
              'doctype-public-literal'
            )
          }

          break
        }

        case 'IN_PUBLIC_LITERAL': {
          if (code === marker) {
            state = 'AFTER_PUBLIC_LITERAL'
            node.public = value.slice(start, index)
          } else if (isPubidChar(code)) {
            // As expected.
          } else {
            fail(
              'Expected pubid character in public literal',
              'doctype-public-literal'
            )
          }

          break
        }

        case 'AFTER_PUBLIC_LITERAL': {
          if (isSpace(code)) {
            // As expected.
            state = 'BEFORE_SYSTEM_LITERAL'
          } else {
            fail(
              'Expected whitespace after public literal',
              'doctype-system-literal'
            )
          }

          break
        }

        case 'BEFORE_SYSTEM_LITERAL': {
          if (isSpace(code)) {
            // As expected.
          } else if (code === 34 /* `"` */ || code === 39 /* `'` */) {
            state = 'IN_SYSTEM_LITERAL'
            start = index + 1
            marker = code
          } else {
            fail(
              'Expected quote or apostrophe to start system literal',
              'doctype-system-literal'
            )
          }

          break
        }

        case 'IN_SYSTEM_LITERAL': {
          // Handled by SAX, but keep it to guard against changes in newer sax
          // versions.
          /* c8 ignore next 5 */
          if (code === null /* EOF */) {
            fail(
              'Expected quote or apostrophe to end system literal',
              'doctype-system-literal'
            )
          } else if (code === marker) {
            state = 'AFTER_SYSTEM_LITERAL'
            node.system = value.slice(start, index)
          } else {
            // As expected.
          }

          break
        }

        case 'AFTER_SYSTEM_LITERAL': {
          if (code === null /* EOF */) {
            // Done.
          } else if (isSpace(code)) {
            // As expected.
          } else if (code === 91 /* `[` */) {
            fail('Unexpected internal subset', 'internal-subset')
          } else {
            fail('Expected whitespace or end of doctype', 'system-literal')
          }

          break
        }

        // Guard against new states.
        /* c8 ignore next 3 */
        default: {
          throw new Error('Unhandled state `' + state + '`')
        }
      }
    }

    enter(node)
    exit()
  }

  /**
   * Handle a processing instruction.
   *
   * @param {{name: string, body: string}} value
   *   Processing instruction token.
   * @returns {void}
   *   Nothing.
   */
  function onprocessinginstruction(value) {
    enter({type: 'instruction', name: value.name, value: value.body})
    exit()
  }

  /**
   * Handle a comment.
   *
   * @param {string} value
   *   Comment value.
   * @returns {void}
   *   Nothing.
   */
  function oncomment(value) {
    /** @type {Comment} */
    const node = {type: 'comment', value}

    // Comment has a positional bug… 😢
    // They end right before the last character (`>`), so let’s add that:
    const actualEnd = now()

    /* c8 ignore next 3 */
    if (typeof actualEnd.offset !== 'number') {
      throw new TypeError('Expected offset')
    }

    actualEnd.column++
    actualEnd.offset++

    enter(node)
    exit()

    /* c8 ignore next */
    if (!node.position) throw new Error('Expected position')
    node.position.end = Object.assign({}, actualEnd)
    position = actualEnd
  }

  /**
   * Handle CDATA opening.
   *
   * @returns {void}
   *   Nothing.
   */
  function oncdataopen() {
    enter({type: 'cdata', value: ''})
  }

  /**
   * Handle CDATA value.
   *
   * @param {string} value
   *   CDATA value.
   * @returns {void}
   *   Nothing.
   */
  function oncdatavalue(value) {
    // @ts-expect-error: assume literal.
    stack[stack.length - 1].value += value
  }

  /**
   * Handle text.
   *
   * @param {string} value
   *   Text value.
   * @returns {void}
   *   Nothing.
   */
  function ontext(value) {
    /** @type {Text} */
    const node = {type: 'text', value}
    // Text has a positional bug… 😢
    // When they are added, the position is already at the next token.
    // So let’s reverse that.
    const actualEnd = Object.assign({}, position)
    let start = 0

    while (start < value.length) {
      search.lastIndex = start
      const match = search.exec(value)

      if (match) {
        actualEnd.line++
        actualEnd.column = 1
        start = match.index + match[0].length
      } else {
        actualEnd.column += value.length - start
        start = value.length
      }
    }

    /* c8 ignore next */
    if (typeof actualEnd.offset !== 'number') throw new Error('Expected offset')

    actualEnd.offset += value.length

    enter(node)
    exit()

    /* c8 ignore next */
    if (!node.position) throw new Error('Expected position')
    node.position.end = Object.assign({}, actualEnd)
    position = actualEnd
  }

  /**
   * Handle tag opening.
   *
   * @param {Tag} value
   *   SAX tag.
   * @returns {void}
   *   Nothing.
   */
  function onopen(value) {
    enter({
      type: 'element',
      name: value.name,
      attributes: value.attributes,
      children: []
    })
  }

  /**
   * Enter a xast node.
   *
   * @param {Node} node
   *   xast node.
   * @returns {void}
   *   Nothing.
   */
  function enter(node) {
    // @ts-expect-error Set later.
    node.position = {start: Object.assign({}, position), end: undefined}
    // @ts-expect-error Assume valid child.
    stack[stack.length - 1].children.push(node)
    stack.push(node)
    position = now()
  }

  /**
   * Exit a xast node.
   *
   * @returns {void}
   *   Nothing.
   */
  function exit() {
    const tail = stack.pop()
    /* c8 ignore next */
    if (!tail || !tail.position) throw new Error('Expected tail')
    position = now()
    tail.position.end = Object.assign({}, position)
  }

  /**
   * Get the current point.
   *
   * @returns {Point}
   *   Now.
   */
  function now() {
    return {
      line: parser.line + 1,
      column: parser.column + 1,
      offset: parser.position
    }
  }

  /**
   * Crash.
   *
   * @param {string} reason
   *   Reason for crash.
   * @param {string} id
   *   Id of rule.
   * @returns {never}
   *   Never.
   */
  function fail(reason, id) {
    throw new VFileMessage(reason, now(), 'xast-util-from-xml:' + id)
  }
}

/**
 * Check if a code is a name start character.
 *
 * See: <https://www.w3.org/TR/xml/#NT-NameStartChar>
 *
 * @param {number | null} code
 *   Code to check.
 * @returns {boolean}
 *   Whether `code` is a name start character.
 */
function isNameStartChar(code) {
  return (
    code !== null &&
    // eslint-disable-next-line no-misleading-character-class
    /[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/.test(
      fromCharCode(code)
    )
  )
}

/**
 * Check if a code is a name continuation character.
 *
 * See: <https://www.w3.org/TR/xml/#NT-NameChar>
 *
 * @param {number | null} code
 *   Code to check.
 * @returns {boolean}
 *   Whether `code` is a name continuation character.
 */
function isNameChar(code) {
  return (
    code !== null &&
    (isNameStartChar(code) ||
      // eslint-disable-next-line no-misleading-character-class
      /[-.\d\u00B7\u0300-\u036F\u203F\u2040]/.test(fromCharCode(code)))
  )
}

/**
 * Check if a code is whitespace.
 *
 * @param {number | null} code
 *   Code to check.
 * @returns {boolean}
 *   Whether `code` is whitespace.
 */
function isSpace(code) {
  return code !== null && /[\t\n\r ]/.test(fromCharCode(code))
}

/**
 * Check if a code is a public ID character.

 * @param {number | null} code
 *   Code to check.
 * @returns {boolean}
 *   Whether `code` is a public ID character.
 */
function isPubidChar(code) {
  return code !== null && /[\n\r !#$%'-;=?-Z_a-z]/.test(fromCharCode(code))
}
