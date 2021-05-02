/**
 * @typedef {import('xast').Root} Root
 * @typedef {import('xast').Element} Element
 * @typedef {import('xast').Comment} Comment
 * @typedef {import('xast').Text} Text
 * @typedef {import('xast').Doctype} Doctype
 * @typedef {import('xast').RootChildMap} RootChildMap
 * @typedef {RootChildMap[keyof RootChildMap]} Child
 * @typedef {Root|Child} Node
 * @typedef {import('unist').Point} Point
 * @typedef {import('sax').Tag} Tag
 *
 */

import sax from 'sax'
import Message from 'vfile-message'

var Parser = sax.SAXParser

var fromCharCode = String.fromCharCode

var search = /\r?\n|\r/g

/**
 * @param {string|Uint8Array} doc
 */
export function fromXml(doc) {
  // @ts-ignore `strictEntities` is most definitely fine.
  var parser = new Parser(true, {position: true, strictEntities: true})
  /** @type {Array.<Node>} */
  var stack = [{type: 'root', children: []}]
  var position = now()

  parser.ondoctype = ondoctype
  // @ts-ignore `onsgmldeclaration` is most definitely fine.
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

  // @ts-ignore Buffers are most definitely fine.
  parser.write(doc).close()

  return stack[0]

  /**
   * @param {Error} error
   * @returns {never}
   */
  function onerror(error) {
    var index = error.message.indexOf('\nLine')
    // The substring should always be included, but this guards against
    // changes in newer sax versions.
    /* c8 ignore next */
    fail(index === -1 ? error.message : error.message.slice(0, index), 'sax')
  }

  /**
   * @returns {never}
   */
  function onsgmldeclaration() {
    fail('Unexpected SGML declaration', 'unexpected-sgml')
  }

  /**
   * @param {string} value
   * @returns {void}
   */
  // eslint-disable-next-line complexity
  function ondoctype(value) {
    /** @type {Doctype} */
    var node = {type: 'doctype', name: '', public: null, system: null}
    var index = -1
    var state = 'BEGIN'
    /** @type {string} */
    var returnState
    /** @type {string} */
    var buffer
    /** @type {number} */
    var bufferIndex
    /** @type {number} */
    var start
    /** @type {number} */
    var marker
    /** @type {number} */
    var code

    while (++index <= value.length) {
      code = index === value.length ? null /* EOF */ : value.charCodeAt(index)

      switch (state) {
        case 'BEGIN':
          if (isSpace(code)) {
            state = 'BEFORE_NAME'
          } else {
            fail('Expected doctype name', 'doctype-name')
          }

          break
        case 'BEFORE_NAME':
          if (isSpace(code)) {
            // As expected.
          } else if (isNameStartChar(code)) {
            state = 'IN_NAME'
            start = index
          } else {
            fail('Expected start of doctype name', 'doctype-name')
          }

          break
        case 'IN_NAME':
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
        case 'AFTER_NAME':
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
        case 'IN_EID':
          if (code === buffer.charCodeAt(++bufferIndex)) {
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
        case 'AFTER_PUBLIC':
          if (isSpace(code)) {
            state = 'BEFORE_PUBLIC_LITERAL'
          } else {
            fail('Expected whitespace after `PUBLIC`', 'doctype-public-literal')
          }

          break
        case 'AFTER_SYSTEM':
          if (isSpace(code)) {
            state = 'BEFORE_SYSTEM_LITERAL'
          } else {
            fail('Expected whitespace after `SYSTEM`', 'doctype-system-literal')
          }

          break
        case 'BEFORE_PUBLIC_LITERAL':
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
        case 'IN_PUBLIC_LITERAL':
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
        case 'AFTER_PUBLIC_LITERAL':
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
        case 'BEFORE_SYSTEM_LITERAL':
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
        case 'IN_SYSTEM_LITERAL':
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

        case 'AFTER_SYSTEM_LITERAL':
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
        // Guard against new states.
        /* c8 ignore next 2 */
        default:
          throw new Error('Unhandled state `' + state + '`')
      }
    }

    enter(node)
    exit()
  }

  /**
   * @param {{name: string, body: string}} value
   * @returns {void}
   */
  function onprocessinginstruction(value) {
    enter({type: 'instruction', name: value.name, value: value.body})
    exit()
  }

  /**
   * @param {string} value
   * @returns {void}
   */
  function oncomment(value) {
    /** @type {Comment} */
    var node = {type: 'comment', value}

    // Comment has a positional bug… 😢
    // They end right before the last character (`>`), so let’s add that:
    var actualEnd = now()
    actualEnd.column++
    actualEnd.offset++

    enter(node)
    exit()

    node.position.end = Object.assign({}, actualEnd)
    position = actualEnd
  }

  /**
   * @returns {void}
   */
  function oncdataopen() {
    enter({type: 'cdata', value: ''})
  }

  /**
   * @param {string} value
   * @returns {void}
   */
  function oncdatavalue(value) {
    stack[stack.length - 1].value += value
  }

  /**
   * @param {string} value
   * @returns {void}
   */
  function ontext(value) {
    /** @type {Text} */
    var node = {type: 'text', value}
    // Text has a positional bug… 😢
    // When they are added, the position is already at the next token.
    // So let’s reverse that.
    var actualEnd = Object.assign({}, position)
    var start = 0
    /** @type {RegExpMatchArray} */
    var match

    while (start < value.length) {
      search.lastIndex = start
      match = search.exec(value)

      if (match) {
        actualEnd.line++
        actualEnd.column = 1
        start = match.index + match[0].length
      } else {
        actualEnd.column += value.length - start
        start = value.length
      }
    }

    actualEnd.offset += value.length

    enter(node)
    exit()

    node.position.end = Object.assign({}, actualEnd)
    position = actualEnd
  }

  /**
   * @param {Tag} value
   * @returns {void}
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
   * @param {Node} node
   * @returns {void}
   */
  function enter(node) {
    node.position = {start: Object.assign({}, position), end: undefined}
    // @ts-ignore Assume valid child.
    stack[stack.length - 1].children.push(node)
    stack.push(node)
    position = now()
  }

  /**
   * @returns {void}
   */
  function exit() {
    position = now()
    stack.pop().position.end = Object.assign({}, position)
  }

  /**
   * @returns {Point}
   */
  function now() {
    return {
      line: parser.line + 1,
      column: parser.column + 1,
      offset: parser.position
    }
  }

  /**
   * @param {string} reason
   * @param {string} id
   * @returns {never}
   */
  function fail(reason, id) {
    throw new Message(reason, now(), 'xast-util-from-xml:' + id)
  }
}

/**
 * See: <https://www.w3.org/TR/xml/#NT-NameStartChar>
 *
 * @param {number} code
 * @returns {boolean}
 */
function isNameStartChar(code) {
  return /[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/.test(
    fromCharCode(code)
  )
}

/**
 * See: <https://www.w3.org/TR/xml/#NT-NameChar>
 *
 * @param {number} code
 * @returns {boolean}
 */
function isNameChar(code) {
  return (
    isNameStartChar(code) ||
    /[-.\d\u00B7\u0300-\u036F\u203F\u2040]/.test(fromCharCode(code))
  )
}

/**
 * @param {number} code
 * @returns {boolean}
 */
function isSpace(code) {
  return /[\t\n\r ]/.test(fromCharCode(code))
}

/**
 * @param {number} code
 * @returns {boolean}
 */
function isPubidChar(code) {
  return /[\n\r !#$%'-;=?-Z_a-z]/.test(fromCharCode(code))
}
