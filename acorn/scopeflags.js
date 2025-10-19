// Each scope gets a bitset that may contain these flags
const
    SCOPE_TOP = 1,
    SCOPE_FUNCTION = 2,
    SCOPE_VAR = SCOPE_TOP | SCOPE_FUNCTION,
    SCOPE_ASYNC = 4,
    SCOPE_GENERATOR = 8,
    SCOPE_ARROW = 16,
    SCOPE_SIMPLE_CATCH = 32,
    SCOPE_SUPER = 64,
    SCOPE_DIRECT_SUPER = 128

function functionFlags(async, generator) {
  return SCOPE_FUNCTION | (async ? SCOPE_ASYNC : 0) | (generator ? SCOPE_GENERATOR : 0)
}

// Used in checkLVal and declareName to determine the type of a binding
const
    BIND_NONE = 0, // Not a binding
    BIND_VAR = 1, // Var-style binding
    BIND_LEXICAL = 2, // Let- or const-style binding
    BIND_FUNCTION = 3, // Function declaration
    BIND_SIMPLE_CATCH = 4, // Simple (identifier pattern) catch binding
    BIND_OUTSIDE = 5 // Special case for function names as bound inside the function


module.exports = {
    SCOPE_TOP: SCOPE_TOP,
    SCOPE_FUNCTION: SCOPE_FUNCTION,
    SCOPE_VAR: SCOPE_VAR,
    SCOPE_ASYNC: SCOPE_ASYNC,
    SCOPE_GENERATOR: SCOPE_GENERATOR,
    SCOPE_ARROW: SCOPE_ARROW,
    SCOPE_SIMPLE_CATCH: SCOPE_SIMPLE_CATCH,
    SCOPE_SUPER: SCOPE_SUPER,
    SCOPE_DIRECT_SUPER: SCOPE_DIRECT_SUPER,
    functionFlags: functionFlags,
    BIND_NONE: BIND_NONE,
    BIND_VAR: BIND_VAR,
    BIND_LEXICAL: BIND_LEXICAL,
    BIND_FUNCTION: BIND_FUNCTION,
    BIND_SIMPLE_CATCH: BIND_SIMPLE_CATCH,
    BIND_OUTSIDE: BIND_OUTSIDE,
};
