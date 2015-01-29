var SymbolTable = require("./symbol-table");

// Add a veneer of extra functionality over the symbol table.
var OffsetTable = module.exports = function OffsetTable() {
	this.clearSymbolTable();
};

OffsetTable.prototype.clearSymbolTable = function () {
	this.insertionOrder = 0;
	this.label = 0;
	this.firstArg = true;
	this.table = {};
};

/**
 * Liking the two different symbol table classes less and less.
 * @type {string}
 */
OffsetTable.RETURN_VARIABLE_TYPE = SymbolTable.RETURN_VARIABLE_TYPE;
OffsetTable.LOCAL_VARIABLE_TYPE = SymbolTable.LOCAL_VARIABLE_TYPE;
OffsetTable.ARGUMENT_VARIABLE_TYPE = SymbolTable.ARGUMENT_VARIABLE_TYPE;

OffsetTable.prototype.get = function (v) {
	return this.table[v];
};

/**
 * Remove everything that should be removed when making a new function.
 */
OffsetTable.prototype.clearVariables = function () {
	this.clearSymbolTable();
};

OffsetTable.prototype.addId = function (v) {
	var tmp = v.split(":");
	this.table[v] = {};
	this.table[v].name = v;
	this.table[v].symbol = tmp[0];
	this.table[v].type = tmp[1];
	this.table[v].isConst = [SymbolTable.INTEGER_CONST_TYPE, SymbolTable.FLOATING_CONST_TYPE].indexOf(tmp[1]) >= 0;
	return this.table[v];
};

OffsetTable.prototype.orderedAdd = function (v, usage) {
	/**
	 * just return it if it already exists
	 */
	var entry = this.get(v);
	if (entry) return entry;

	usage = usage || "---";

	// Perform the basic add.
	entry = this.addId(v);

	/**
	 * I don't think an 'arg' usage will ever be a constant.
	 */
	if (usage === 'arg' && entry.isConst) throw new Error("assert 'arg' usage for a constant is too weird.");

	// Don't add offsets to constants.
	if (!entry.isConst) entry.insertionOrder = this.insertionOrder++;

	entry.usage = usage;

	return entry;
};

/**
 * Used for things that are unassociated with the stack frame.
 * @param v
 * @param usage
 */
OffsetTable.prototype.addWithoutOffset = function (v, usage) {
	var entry = this.addId(v);
	entry.usage = usage;
	return entry;
};

OffsetTable.prototype.getRelativeLabel = function () {
	return this.addWithoutOffset("L" + (this.label++) + ":label", "label");
};

OffsetTable.prototype.getAbsoluteLabel = function () {
	return this.getRelativeLabel();
	//return this.addWithoutOffset("L"+(this.label++)+":label", "label");
};
//
//OffsetTable.prototype.isConst = function (v) {
//	return [SymbolTable.INTEGER_CONST_TYPE, SymbolTable.FLOATING_CONST_TYPE].indexOf(this.table[v].type) >= 0;
//};

OffsetTable.prototype.value = function (v) {
	return this.table[v].symbol;
};

OffsetTable.prototype.offset = function (v) {
	return this.table[v].offset;
};

OffsetTable.LOCAL_VARIABLE_TYPES = [
	OffsetTable.LOCAL_VARIABLE_TYPE
];

OffsetTable.STACK_FRAME_VARIABLE_TYPES = [ SymbolTable.LOCAL_VARIABLE_TYPE,
	SymbolTable.ARGUMENT_VARIABLE_TYPE, SymbolTable.RETURN_VARIABLE_TYPE];

OffsetTable.prototype.getNumberOfLocals = function () {
	return this.getLocals().length;
};

OffsetTable.prototype.setOffsets = function() {
	var symbs = [];

	this.getLocals().forEach(function(v) {
		symbs[v.insertionOrder] = v;
	});

	this.getArguments().forEach(function(v){
		symbs[v.insertionOrder] = v;
	});

	var v = this.findReturnVariable();
	symbs[v.insertionOrder] = v;

	var firstDecl = true;
	var offset = symbs.length;
	for(var i=0; i<symbs.length; i++) {
		if (OffsetTable.LOCAL_VARIABLE_TYPES.indexOf(symbs[i].usage) >= 0 && firstDecl) {
			firstDecl = false;
			offset--;	// skip the return address which is nestled between the arguments and the local variables.
		}
		symbs[i].offset = offset--;
	}
};

OffsetTable.prototype.getArguments = function () {
	var arguments = [];
	var keys = Object.keys(this.table);
	for(var i = 0; i<keys.length; i++) {
		var e = this.table[keys[i]];
		if (e.usage === OffsetTable.ARGUMENT_VARIABLE_TYPE) arguments.push(e);
	}
	return arguments;
};

OffsetTable.prototype.getStackFrameVariables = function () {
	var stackFrameVariables = [];
	var keys = Object.keys(this.table);
	for(var i = 0; i<keys.length; i++) {
		var e = this.table[keys[i]];
		if (OffsetTable.STACK_FRAME_VARIABLE_TYPES.indexOf(e.type) >= 0) stackFrameVariables.push(e);
	}
	return stackFrameVariables;
};

OffsetTable.prototype.findReturnVariable = function() {
	var keys = Object.keys(this.table);
	for(var i = 0; i<keys.length; i++) {
		var e = this.table[keys[i]];
		if (e.usage === OffsetTable.RETURN_VARIABLE_TYPE) return e;
	}
	return undefined;
};

OffsetTable.prototype.getLocals = function () {
	var locals = [];
	var keys = Object.keys(this.table);
	for(var i = 0; i<keys.length; i++) {
		var e = this.table[keys[i]];
		if (OffsetTable.LOCAL_VARIABLE_TYPES.indexOf(e.usage) >= 0) locals.push(e);
	}
	return locals;
};
OffsetTable.prototype.addDim = function(v, bound) {
	var entry = this.table[v];
	entry.isArray = true;
	entry.dims = entry.dims || [];
	entry.dims.push(bound);
};

OffsetTable.prototype.addToSymbolTable = function (stackVal) {
	// If we know the variable, we don't have to make it known again.
	if (!entry(stackVal.d[0][1])) {
		addWithIndex(stackVal.d[0][1], stackVal.d[0][0]);
		return true;
	}
	return false;
};


