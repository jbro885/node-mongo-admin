'use strict'

let ngram = require('./ngram')

/**
 * Make suggestions based on the cursor position and schema definition
 * @param {ParsedObject} parsed
 * @param {Schema} schema
 * @returns {Array<string>}
 */
module.exports = function (parsed, schema) {
	return processCursorInFind(parsed, schema, '')
}

/*
 * The mongodb query structure is depicted bellow:
 * 
 * {name: {$ne: 'John'}}
 * ^      ^     ^
 * |      |     +- value
 * |      +- field expression
 * +- find
 * 
 * Each context have different suggestion mechanisms.
 * For example, in the find context fields are suggested,
 * while in the field expression context operators are suggested
 */

/**
 * Process cursor in a find construction
 * @param {ParsedObject} parsed
 * @param {Schema} schema
 * @param {string} prefix
 * @returns {Array<string>}
 */
function processCursorInFind(parsed, schema, prefix) {
	if (parsed.cursor === -1) {
		// Nothing is focused
		return []
	} else if (parsed.cursor === parsed.properties.length) {
		// Empty property focused
		return suggestFields('', schema, prefix)
	}

	let property = parsed.properties[parsed.cursor],
		subPrefix = prefix ? prefix + '.' + property.key : property.key
	if (property.keyCursor !== -1) {
		// Key has focus
		return suggestFields(property.key.slice(0, property.keyCursor), schema, prefix)
	} else if (property.key === '$or' || property.key === '$and' || property.key === '$nor') {
		// Multiple sub-finds
		if (property.value.type !== 'array') {
			return []
		}

		let element = property.value.values[property.value.cursor]
		if (!element || element.type !== 'object') {
			return []
		}

		return processCursorInFind(element, schema, prefix)
	} else if (property.value.type === 'array' || property.value.type === 'source') {
		// Focus in field value
		return suggestValues(property.value.raw, schema, subPrefix)
	} else if (property.value.type === 'object') {
		return processCursorInFieldExp(property.value, schema, subPrefix)
	} else {
		// Unknown
		return []
	}
}

/**
 * @param {ParsedObject} parsed
 * @param {Schema} schema
 * @param {string} prefix
 * @returns {Array<string>}
 */
function processCursorInFieldExp(parsed, schema, prefix) {
	if (parsed.properties.some(property => property.key[0] !== '$')) {
		// Not actually a field expression, like in '{a: {b: 2}}',
		// '{b: 2}' is not a field expression
		return suggestValues(parsed.raw, schema, prefix)
	}

	if (parsed.cursor === -1) {
		// Nothing is focused
		return []
	} else if (parsed.cursor === parsed.properties.length) {
		// Empty property focused
		return suggestOperators('', schema, prefix)
	}

	let property = parsed.properties[parsed.cursor],
		key = property.key
	if (property.keyCursor !== -1) {
		// Key has focus
		return suggestOperators(property.key.slice(0, property.keyCursor), schema, prefix)
	} else if (key === '$eq' || key === '$ne' ||
		key === '$gt' || key === '$gte' ||
		key === '$lt' || key === '$lte') {
		// COMP VALUE
		return suggestValues(property.value.raw, schema, prefix)
	} else if (key === '$in' || key === '$nin' || key === '$all') {
		// COMP [VALUE]
		if (property.value.type !== 'array') {
			return []
		}

		let element = property.value.values[property.value.cursor]
		if (!element) {
			return []
		}

		return suggestValues(element.raw, schema, prefix)
	} else if (key === '$not') {
		// $not FIELD-EXP
		if (property.value.type !== 'object') {
			return []
		}

		return processCursorInFieldExp(property.value, schema, prefix)
	} else if (key === '$exists') {
		// $exists BOOL
		return ['true', 'false']
	} else if (key === '$type') {
		// $type STRING | $type NUM
		return ['enums for $type']
	} else if (key === '$mod') {
		// $mod [NUM, NUM]
		return ['[divisor, remainder]']
	} else if (key === '$elemMatch') {
		// $elemMatch FIND
		if (property.value.type !== 'object') {
			return []
		}

		return processCursorInFind(property.value, schema, prefix)
	} else if (key === '$size') {
		// $size NUM
		return ['num']
	} else {
		// Unknown
		return []
	}
}

/**
 * @param {string} search
 * @param {Schema} schema
 * @param {string} prefix
 * @returns {Array<string>}
 */
function suggestFields(search, schema, prefix) {
	// search='a', prefix='' -> prefix='', field='a'
	// search='a.b', prefix='' -> prefix='a.', field='b'
	// search='a', prefix='x' -> prefix='x.', field='a'
	// search='ab.cd.e', prefix='x' -> prefix='x.ab.cd.', field='e'
	let lastDot = search.lastIndexOf('.'),
		pathPrefix = (prefix ? prefix + '.' : '') +
		(lastDot === -1 ? '' : search.slice(0, lastDot + 1)),
		field = lastDot === -1 ? search : search.slice(lastDot + 1),
		fieldLC = field.toLowerCase(),
		/** @var {Array<{text: string, depth: number}>} */
		searchSpace = []

	// Collect fields in the same and following levels
	for (let path in schema) {
		if (path.startsWith(pathPrefix)) {
			let text = path.slice(pathPrefix.length)
			searchSpace.push({
				text: text,
				terms: text.toLowerCase().split('.')
			})
		}
	}

	let matches
	if (field.length <= 3) {
		// Make a case-insensitive prefix match
		matches = searchSpace.filter(item => {
			return item.terms.some(part => {
				return part.startsWith(fieldLC)
			})
		}).sort((a, b) => {
			// Depth ASC
			return a.terms.length - b.terms.length
		})
	} else {
		// Make a case-insensitive ngram match
		matches = ngram.search(ngram.index(searchSpace), [fieldLC]).sort((a, b) => {
			// Depth ASC, score DESC
			return a.value.terms.length - b.value.terms.length || b.score - a.score
		}).map(e => e.value)
	}

	// Pick 5
	return matches.slice(0, 5).map(e => e.text)
}

/**
 * @param {string} search
 * @param {Schema} schema
 * @returns {Array<string>}
 */
function suggestOperators(search, schema) {
	return ['operators', search]
}
/**
 * @param {string} search
 * @param {Schema} schema
 * @returns {Array<string>}
 */
function suggestValues(search, schema) {
	return ['values', search]
}