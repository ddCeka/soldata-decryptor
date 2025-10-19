const {hasOwnProperty, toString} = Object.prototype

// Checks if an object has a property.

function has(obj, propName) {
  return hasOwnProperty.call(obj, propName)
}

const isArray = Array.isArray || ((obj) => (
  toString.call(obj) === "[object Array]"
))

function wordsRegexp(words) {
  return new RegExp("^(?:" + words.replace(/ /g, "|") + ")$")
}


module.exports = {
  has: has,
  isArray: isArray,
  wordsRegexp: wordsRegexp,
};
