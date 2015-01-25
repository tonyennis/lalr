"use strict";

var Reductions = module.exports = function Reductions(logger) {
	this.logger = logger;
	this.myId = 100;
};

/**
 *
 * @param reductionNumber
 * @param stack {Array} of Token
 * @param options {Object}
 * @returns {*}
 */
Reductions.prototype.reduce = function (production, context, stack, options) {
	if (production.reduce) {
		return production.reduce(context, stack, options);
	}

	// There is no reduction function, so sploot out something generic.
	var r = this.myId++;
	if (!options.rTerse) {
		var s = "reducing by production: "+production.toString() + "\t\tspecifics: "+r+" =";
		for(var i = 0; i<stack.length; i+=2) {
			s += " "+stack[i].toString();
		}
		this.logger.log(s);
	}
	return r;
};

