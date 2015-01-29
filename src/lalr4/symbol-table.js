"use strict";

/**
 * NOTE - temporary variables are assumed to be numeric and have a type of NUMERIC_TEMP_TYPE. That is, the name
 * if the first temporary variable would be 0:NUMERIC_TEMP_TYPE. A normal program variable, say "cost", would
 * be something like cost:variable. The reason is the 0 is used in an array that allows temp variables to
 * be allocated quickly.
 */

var SymbolTable = module.exports = function SymbolTable() {
	this.reset();
};

SymbolTable.NUMERIC_TYPE = "numeric";
SymbolTable.CHAR_TYPE = "char";

SymbolTable.LOCAL_VARIABLE_TYPE = "local_variable";
SymbolTable.ARGUMENT_VARIABLE_TYPE = "argument_variable";
SymbolTable.RETURN_VARIABLE_TYPE = "return_variable";
SymbolTable.FUNCTION_REF_TYPE = "function_ref";
SymbolTable.FUNCTION_TYPE = "function";
//SymbolTable.INTEGER_CONST_TYPE = "integer_const";
//SymbolTable.FLOATING_CONST_TYPE = "floating_const";
SymbolTable.LABEL_TYPE = "label";
SymbolTable.MAX = 100;

SymbolTable.DATA_TYPES = [
	SymbolTable.NUMERIC_TYPE,
	SymbolTable.CHAR_TYPE
];

/**
 * A variable in the symbol table can have exactly one usage.
 * @type {*[]}
 */
SymbolTable.USAGES = [
	SymbolTable.LOCAL_VARIABLE_TYPE, /* For variables with a local scope. */
	SymbolTable.RETURN_VARIABLE_TYPE, /* For the result of a function. Automatically created. */
	SymbolTable.FUNCTION_REF_TYPE, /* For references to functions.	*/
	SymbolTable.FUNCTION_TYPE, /* For function declarations. These are unique.	*/
	SymbolTable.LABEL_TYPE, /* For labels. These are unique. */
	SymbolTable.ARGUMENT_VARIABLE_TYPE    /* For arguments within a function */
];

SymbolTable.USAGE_NOT_ON_LHS = [
	SymbolTable.FUNCTION_REF_TYPE,
	SymbolTable.FUNCTION_TYPE,
	SymbolTable.LABEL_TYPE,
	SymbolTable.ARGUMENT_VARIABLE_TYPE
];

/**
 * Every symbol in the symbol table should have:
 * type - the data type
 * usage - how the symbol is used. This guides deallocation, reuse, etc
 * isConstant - cannot appear on any LHS
 * constantValue = a value if isConstant === true
 * isInteger - While javascript does not care, sometimes this matters in context. And array index, for example.
 * isArray - gives the cue that there should be (or not be) indices
 * indices - if isArray === true
 */

/**
 *
 * @param _symbolName      Optional. if not specified, a temp will be assigned.
 * @param _type            Optional. if not specified, a bog-standard numeric type will be used.
 * @param _isConstant
 * @param _constantValue
 * @param _usage
 * @returns {string}
 */
SymbolTable.prototype.addId = function (_symbolName, _type, _isConstant, _constantValue, _usage) {

	if (_type && SymbolTable.DATA_TYPES.indexOf(_type) < 0) throw new Error("Unknown type: '" + _type + "'");
	if (_usage && SymbolTable.USAGES.indexOf(_usage) < 0) throw new Error("Unknown usage: '" + _usage + "'");

	var isTemp = false;
	var isConstant = _isConstant || false;
	var usage = _usage || SymbolTable.LOCAL_VARIABLE_TYPE;
	var type;
	if (SymbolTable.USAGE_NOT_ON_LHS.indexOf(usage) >= 0) {
		isConstant = true;
		// If there is no type (and we know that this is a special usage) use the usage as the type. Bad idea? Maybe.
		// Otherwise, use the given type.
		type = _type ? _type : usage;
	} else {
		// Use the given type or the numeric default.
		type = _type || SymbolTable.NUMERIC_TYPE;
	}

	var symbolName = _symbolName;// || undefined;

	if (SymbolTable.USAGE_NOT_ON_LHS.indexOf(usage) >= 0) isConstant = true;

	if (typeof symbolName === 'undefined') {
		symbolName = this.freeStack.pop();
		if (typeof symbolName === 'undefined') throw new Error("temp variables depleted.");
		isTemp = true;
	}

	// If this is a constant yet no value is given, use the symbol name. Else, undefined. This
	// is important because some constants (labels, for example) don't really have 'values' beyond
	// their names.  We could probably safely limit constants to numeric types.
	var constantValue = isConstant ? (_constantValue || symbolName) : undefined;

	var name = symbolName + ":" + type;
	if (typeof this.table[name] !== 'undefined') return name;
	this.table[name] = {
		usage: usage,
		name: name,
		symbolName: symbolName,
		type: type,
		isTemp: isTemp,
		isConstant: isConstant,
		constantValue: constantValue,
		isArray: false,
		indices: undefined
	};
	return name;	//TODO perhaps I should return this.table[name]
};

/**
 * Return the symbol table entry for the given name. This is a little tricky as the source code refers to the
 * name one way [symbolName] while internal code refers to it by [name]. So first try to find by name. If this
 * fails, try to find by symbol name. I can't think of a case where this could be ambiguous as the [name] includes
 * a character (:) which is not allowed in symbol names.
 * @param name
 * @returns {*}
 */
SymbolTable.prototype.get = function (name) {
	var entry = this.table[name];
	if (entry) return entry;
	// We have to do it the hard way.
	var keys = Object.keys(this.table);
	for (var i = 0; i < keys.length; i++) {
		entry = this.table[keys[i]];
		if (entry && entry.symbolName === name) return entry;
	}
	return undefined;
};

/**
 * Return all the local variables
 */
SymbolTable.prototype.getLocalVariables = function () {
	var entries = [];
	var self = this;
	Object.keys(this.table).forEach(function (k) {
		if (self.table[k].usage === SymbolTable.LOCAL_VARIABLE_TYPE) entries.push(self.table[k]);
	});
	return entries;
};


SymbolTable.prototype.setSymbolArrayBounds = function (symbol, arrayOfBounds) {
	var stEntry = this.get(symbol);
	if (arrayOfBounds.length > 0) {
		stEntry.isArray = true;
		stEntry.bounds = arrayOfBounds.slice();
	} else {
		stEntry.isArray = false;
	}
};

SymbolTable.calculateArrayIndexMultipliers = function (entry) {
	entry.boundsMult = [];
	entry.boundsMult[entry.bounds.length - 1] = 1;
	for (var i = entry.bounds.length - 2; i >= 0; i--) {
		entry.boundsMult[i] = entry.boundsMult[i + 1] * entry.bounds[i + 1];
	}
};

SymbolTable.prototype.getReturnVariableName = function () {
	var keys = Object.keys(this.table);
	for (var i = 0; i < keys.length; i++) {
		var entry = this.table[keys[i]];
		if (entry.usage === SymbolTable.RETURN_VARIABLE_TYPE) return entry.name;
	}
	return undefined;
};

/**
 * Perform a full initialization.
 */
SymbolTable.prototype.reset = function () {
	this.table = {};
	this.freeStack = [];
	for (var i = 0; i < SymbolTable.MAX; i++) this.freeStack.push(i);
};

/**
 * This is a special kind of temp variable.  When a function is called, a special variable is
 * inserted into the argument list as the first argument. This is for the function's return value.
 * Called getReturnTemp creates a standard tmp variable in the symbol table augmented with the returnTemp
 * flag.  This will allow the code generator to divine the return variable.
 */
SymbolTable.prototype.getReturnTemp = function () {
	return this.addId(undefined, SymbolTable.NUMERIC_TYPE, undefined, undefined, SymbolTable.RETURN_VARIABLE_TYPE);
};

/**
 * Free all common temp variables passed into this function
 * @param inUseArray
 */
SymbolTable.prototype.free = function (inUseArray) {
	for (var i = 0; i < inUseArray.length; i++) {
		var entry = this.get(inUseArray[i]);
		if (entry && entry.isTemp) {
			this.freeStack.push(entry.symbolName);
			delete this.table[entry.name];
		}
	}
};


SymbolTable.prototype.makeLabel = function () {
	return this.addId(undefined, SymbolTable.LABEL_TYPE, true);
};

SymbolTable.prototype.array = function (cb) {
	var keys = Object.keys(this.table);
	for (var i = 0; i < keys.length; i++) {
		if (this.table[keys[i]]) cb(this.table[keys[i]]);
	}
};