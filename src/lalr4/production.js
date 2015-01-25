"use strict;"

var EPSILON = "";
var Production = module.exports = function Production(name, rhs, reduce) {
	if (!rhs || typeof rhs !== 'object') throw new Error("Assert - constructor for Production requires a non-empty rhs, production name is", name);
	if (reduce && typeof reduce !== 'function') throw new Error("Assert - constructor for Production requires the reduce function be a function or omitted.", reduce);
	this.name = name;
	this.reduce = reduce;
	if (rhs.length === 1 && rhs[0] === EPSILON) { //BUG I don't believe any of the current epsilon stuff.
		this.epsilon = true;
		this.rhs = [];
	} else {
		this.epsilon = false;
		rhs.forEach(function(s) {
			if (s === EPSILON) throw new Error("Epsilon must be the production's first symbol.", name, rhs);
		});
		this.rhs = rhs || [];
	}
};

Production.prototype.copy = function copy() {
	var c = new Production(this.name, [], this.reduceFunc);
	c.rhs = this.rhs.map(function (s) {
		return s;
	});
	return c;
};

Production.prototype.toString = function () {
	return this.reductionId  + ". " + this.name + " -> " + this.rhs.join(" ");
};