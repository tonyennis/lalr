"use strict;"

var Util = require("./util");

var First = module.exports = function First() {
	this.first = {};
};

First.EPSILON = undefined;

First.prototype.init = function (name) {
	this.first[name] = this.first[name] || {symbols: [], hasEpsilon: false};
};
First.prototype.add = function (name, symbol, addEpsilon) {
	this.init(name);
	if (addEpsilon && symbol === First.EPSILON) this.first[name].hasEpsilon = true;
	else if (symbol !== First.EPSILON && this.first[name].symbols.indexOf(symbol) < 0) this.first[name].symbols.push(symbol);
};
First.prototype.addNonterm = function (name, addFrom) {
	var symbols = (this.first[addFrom] && this.first[addFrom].symbols) || [];
	var self = this;
	symbols.forEach(function (s) {
		self.add(name, s, false);
	});
};
First.prototype.hasEpsilon = function (name) {
	return !!(this.first[name] && this.first[name].hasEpsilon);
};
First.prototype.symbols = function(name) {
	return (this.first[name] && this.first[name].symbols) || [];
};
First.prototype.calc = function (grammar) {

	// Collect all the terminals and establish epsilon.
	var i;
	var p;
	var j;
	var panic = 0;
	var oldFirst = "";
	var PANIC = 100;

	// The first values can propagate. For example, if we have
	// A->B
	// B->C
	// C->epsilon
	// We will not know first(A) includes epsilon until it has time to propagate from C up through B to A.
	// Also, grammars can be circular, so a recursive algorithm would suffer the same issue.
	while (++panic < PANIC && oldFirst !== JSON.stringify(this)) {
		oldFirst = JSON.stringify(this);

		// Scoop up the terminals. I probably only need to do this once.
		for (i = 0; i < grammar.productions.length; i++) {
			p = grammar.productions[i];
			if (Util.isTerminal(p.rhs[0])) {
				this.add(p.name, p.rhs[0], true);
			}
		}

		// Propagate the terminals from leading non-terminals.
		// A-> B C D
		// first(A) = first(A) union first(B) (excluding epsilon from first(B))
		// if first(B) includes epsilon, then first(A) = first(A) union first(B) union first(C) (and so forth)
		// if all of B C and D include epsilon, then first(A) includes epsilon.
		for (i = 0; i < grammar.productions.length; i++) {
			p = grammar.productions[i];
			this.init(p.name);
			var allEpsilons = true;
			for (j = 0; j < p.rhs.length; j++) {
				if (Util.isNonterminal(p.rhs[j])) {
					this.addNonterm(p.name, p.rhs[j]);
					if (!this.hasEpsilon(p.rhs[j])) {
						allEpsilons = false;
						break;
					}
				} else { // We stop when we see a terminal.
					allEpsilons = false;
					break;
				}
			}
			// If we sailed through with all epsilons, add epsilon to p.name
			if (allEpsilons) this.first[p.name].hasEpsilon = true;
		}
	}
	if (panic === PANIC) throw new Error("Panic " + JSON.stringify(this));
};

First.prototype.toString = function () {
	var s = Util.box("First sets");
	var self = this;
	Object.keys(this.first).forEach(function (x) {
		var set = self.first[x];
		s += x + " { ";
		set.symbols.forEach(function (y) {
			s += y + " ";
		});
		s += "} epsilon=" + set.hasEpsilon + "\n";
	});
	return s;
};