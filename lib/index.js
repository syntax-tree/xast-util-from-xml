/**
 * @typedef {import('@rgrove/parse-xml').XmlCdata} XmlCdata
 * @typedef {import('@rgrove/parse-xml').XmlComment} XmlComment
 * @typedef {import('@rgrove/parse-xml').XmlDeclaration} XmlDeclaration
 * @typedef {import('@rgrove/parse-xml').XmlError} XmlError
 * @typedef {import('@rgrove/parse-xml').XmlDocument} XmlDocument
 * @typedef {import('@rgrove/parse-xml').XmlDocumentType} XmlDocumentType
 * @typedef {import('@rgrove/parse-xml').XmlElement} XmlElement
 * @typedef {import('@rgrove/parse-xml').XmlProcessingInstruction} XmlProcessingInstruction
 * @typedef {import('@rgrove/parse-xml').XmlText} XmlText
 *
 * @typedef {import('vfile-location').Location} Location
 *
 * @typedef {import('xast').Cdata} Cdata
 * @typedef {import('xast').Comment} Comment
 * @typedef {import('xast').Doctype} Doctype
 * @typedef {import('xast').Element} Element
 * @typedef {import('xast').Instruction} Instruction
 * @typedef {import('xast').Nodes} Nodes
 * @typedef {import('xast').Root} Root
 * @typedef {import('xast').RootContent} RootContent
 * @typedef {import('xast').Text} Text
 */

/**
 * @typedef {XmlCdata | XmlComment | XmlDeclaration | XmlDocumentType | XmlElement | XmlProcessingInstruction | XmlText} XmlContent
 *   Nodes that occur in XML documents (`parse-xml`).
 * @typedef {XmlContent | XmlDocument} XmlNode
 *   Nodes that occur (`parse-xml`).
 *
 * @typedef State
 *   Info passed around.
 * @property {Location} location
 *   Interface to translate between offsets and points.
 */

import {parseXml} from '@rgrove/parse-xml'
import {location} from 'vfile-location'
import {VFileMessage} from 'vfile-message'

/**
 * Parse a string of XML to a xast tree.
 *
 * @param {Uint8Array | string} value
 *   Serialized XML.
 * @returns {Root}
 *   xast root.
 */
export function fromXml(value) {
  const loc = location(value)
  /** @type {XmlDocument} */
  let xmlDocument

  try {
    xmlDocument = parseXml(String(value), {
      // Positional offsets.
      includeOffsets: true,
      // `<![CDATA[>&<]]>`
      preserveCdata: true,
      // `<!--a-->`
      preserveComments: true,
      // `<!DOCTYPE b>` (a specific declaration)
      preserveDocumentType: true,
      // `<?xml?>` (a specific instruction)
      preserveXmlDeclaration: true
    })
  } catch (error_) {
    const cause = /** @type {XmlError} */ (error_)
    const place = loc.toPoint(cause.pos)
    const message = new VFileMessage(
      'Could not parse XML with `@rgrove/parse-xml`',
      {
        cause,
        place,
        ruleId: 'error',
        source: 'xast-util-from-xml'
      }
    )

    message.fatal = true
    message.url = 'https://github.com/syntax-tree/xast-util-from-xml#throws'

    throw message
  }

  const state = {location: loc}
  const root = transformDocument(xmlDocument, state)
  patch(xmlDocument, root, state)
  return root
}

/**
 * Transform CDATA.
 *
 * @param {XmlCdata} node
 * @returns {Cdata}
 */
function transformCdata(node) {
  return {type: 'cdata', value: node.text}
}

/**
 * Transform comments.
 *
 * @param {XmlComment} node
 *   XML node (`parse-xml`).
 * @returns {Comment}
 *   xast node.
 */
function transformComment(node) {
  return {type: 'comment', value: node.content}
}

/**
 * Transform documents.
 *
 * @param {XmlDocument} node
 *   XML node (`parse-xml`).
 * @param {State} state
 *   Info passed around.
 * @returns {Root}
 *   xast node.
 */
function transformDocument(node, state) {
  const children = transformChildren(node.children, state)
  return {type: 'root', children}
}

/**
 * Transform doctypes.
 *
 * @param {XmlDocumentType} node
 *   XML node (`parse-xml`).
 * @returns {Doctype}
 *   xast node.
 */
function transformDoctype(node) {
  return {
    type: 'doctype',
    name: node.name,
    public: node.publicId || undefined,
    system: node.systemId || undefined
  }
}

/**
 * Transform elements.
 *
 * @param {XmlElement} node
 *   XML node (`parse-xml`).
 * @param {State} state
 *   Info passed around.
 * @returns {Element}
 *   xast node.
 */
function transformElement(node, state) {
  const children = transformChildren(node.children, state)
  return {
    type: 'element',
    name: node.name,
    attributes: {...node.attributes},
    // @ts-expect-error: assume content matches.
    children
  }
}

/**
 * Transform instructions.
 *
 * @param {XmlProcessingInstruction} node
 *   XML node (`parse-xml`).
 * @returns {Instruction}
 *   xast node.
 */
function transformInstruction(node) {
  return {type: 'instruction', name: node.name, value: node.content}
}

/**
 * Transform text.
 *
 * @param {XmlText} node
 *   XML node (`parse-xml`).
 * @returns {Text}
 *   xast node.
 */
function transformText(node) {
  return {type: 'text', value: node.text}
}

/**
 * Transform XML declarations.
 *
 * @param {XmlDeclaration} node
 *   XML node (`parse-xml`).
 * @returns {Instruction}
 *   xast node.
 */
function transformXmlDeclaration(node) {
  /** @type {Array<string>} */
  const value = []

  if (node.version) {
    // > 👉 **Important**: quotes not allowed inside:
    // > <https://www.w3.org/TR/xml/#NT-VersionInfo>.
    // > So no value can break out of this.
    value.push('version="' + node.version + '"')
  }

  if (node.encoding) {
    // > 👉 **Important**: quotes not allowed inside:
    // > <https://www.w3.org/TR/xml/#NT-EncodingDecl>.
    // > So no value can break out of this.
    value.push('encoding="' + node.encoding + '"')
  }

  if (node.standalone) {
    // > 👉 **Important**: quotes not allowed inside:
    // > <https://www.w3.org/TR/xml/#NT-SDDecl>.
    // > So no value can break out of this.
    value.push('standalone="' + node.standalone + '"')
  }

  return {type: 'instruction', name: 'xml', value: value.join(' ')}
}

/**
 * Transform a list of nodes.
 *
 * @param {Array<XmlContent>} children
 *   Nodes to transform (`parse-xml`).
 * @param {State} state
 *   Info passed around.
 * @returns {Array<RootContent>}
 *   xast nodes.
 */
function transformChildren(children, state) {
  /** @type {Array<RootContent>} */
  const results = []
  let index = -1

  while (++index < children.length) {
    const from = children[index]
    /** @type {RootContent | undefined} */
    let to

    if (from.type === 'cdata') {
      const node = /** @type {XmlCdata} */ (from)
      to = transformCdata(node)
    } else if (from.type === 'comment') {
      const node = /** @type {XmlComment} */ (from)
      to = transformComment(node)
    } else if (from.type === 'doctype') {
      const node = /** @type {XmlDocumentType} */ (from)
      to = transformDoctype(node)
    } else if (from.type === 'element') {
      const node = /** @type {XmlElement} */ (from)
      to = transformElement(node, state)
    } else if (from.type === 'pi') {
      const node = /** @type {XmlProcessingInstruction} */ (from)
      to = transformInstruction(node)
    } else if (from.type === 'text') {
      const node = /** @type {XmlText} */ (from)
      to = transformText(node)
    } else if (from.type === 'xmldecl') {
      const node = /** @type {XmlDeclaration} */ (from)
      to = transformXmlDeclaration(node)
    }
    // That should be all.

    if (to) {
      patch(from, to, state)
      results.push(to)
    }
  }

  return results
}

/**
 * Patch positional info.
 *
 * @param {XmlNode} from
 *   XML node (`parse-xml`).
 * @param {Nodes} to
 *   xast node.
 * @param {State} state
 *   Info passed around.
 * @returns {undefined}
 *   Nothing.
 */
function patch(from, to, state) {
  const start =
    // Doesn’t practically happen as far as I found, but `-1` is used in the
    // code, so let’s keep it in.
    /* c8 ignore next */
    from.start === -1 ? undefined : state.location.toPoint(from.start)
  const end =
    // Same as above
    /* c8 ignore next */
    from.end === -1 ? undefined : state.location.toPoint(from.end)

  if (start && end) {
    to.position = {start, end}
  }
}
