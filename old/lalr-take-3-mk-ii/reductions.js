"use strict;";

var Reductions = module.exports = function Reductions(logger) {
	this.logger = logger;
	this.myId = 100;
	this.reductions = [
		function(self, stack, options) { throw new Error("Did not expect to reduce 0.");},
		function(self, stack, options) { if (!options.rTerse) self.logger.log("..."); return stack[0].val;},
		function(self, stack, options) { if (!options.rTerse) self.logger.log("..."); return stack[0].val;},
		function(self, stack, options) { if (!options.rTerse) self.logger.log("..."); return stack[0].val;},
		function(self, stack, options) { if (!options.rTerse) self.logger.log("..."); return stack[4].val;},
		function(self, stack, options) { if (!options.rTerse) self.logger.log("..."); return stack[4].val;},
		function(self, stack, options) { self.logger.log(stack[0].val +"= *"+stack[4].val); return stack[4].val;},
		function(self, stack, options) { var r = self.myId++; self.logger.log(r+" = *"+stack[0].val+" plus *"+stack[4].val); return r;},
		function(self, stack, options) { var r = self.myId++; self.logger.log(r+" = *"+stack[0].val+" minus *"+stack[4].val); return r;},
		function(self, stack, options) { if (!options.rTerse) self.logger.log("..."); return stack[0].val;},
		function(self, stack, options) { var r = self.myId++; self.logger.log(r+" = *"+stack[0].val+" mult *"+stack[4].val); return r;},
		function(self, stack, options) { var r = self.myId++; self.logger.log(r+" = *"+stack[0].val+" div *"+stack[4].val); return r;},
		function(self, stack, options) { if (!options.rTerse) self.logger.log("..."); return stack[0].val;},
		function(self, stack, options) { var r = self.myId++; self.logger.log(r+" = *"+stack[0].val+" pow *"+stack[4].val); return r;},
		function(self, stack, options) { if (!options.rTerse) self.logger.log("..."); return stack[0].val;},
		function(self, stack, options) { if (!options.rTerse) self.logger.log("..."); return stack[0].val;},
		function(self, stack, options) { if (!options.rTerse) self.logger.log("..."); return stack[2].val;}
	];
};

/**
 *
 * @param reductionNumber
 * @param stack {Array} of Token
 * @param options {Object}
 * @returns {*}
 */
Reductions.prototype.reduce = function(reductionNumber, stack, options) {
	if (!options.rTerse) this.logger.log("reducing "+reductionNumber+", stack is "+stack);
	return this.reductions[reductionNumber](this, stack, options);
};

