'use strict';

var isNonterm = function (s) {
	if (typeof s === 'undefined') return false;
	return s[0] >= "A" && s[0] <= "Z";
};

var isTerm = function (s) {
	return !isNonterm(s);
};

var EPSILON = "";
var Production = function Production(name, rhs, reduce) {
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
	return this.reductionId + ". " + this.name + " -> " + this.rhs.join(" ");
};

var DottedProduction = function DottedProduction(name) {
	if (name instanceof Production) {
		this.production = name;
		this.dot = 0;
		if (typeof name === 'undefined') throw new Error("assert 1 - I expected a reduction ID here. name is " + JSON.stringify(name));
		this.reductionId = name.reductionId;
	} else if (name instanceof DottedProduction) {
		this.production = name.production.copy();
		this.dot = name.dot;
		if (typeof name === 'undefined') throw new Error("assert 2 - I expected a reduction ID here. name is " + JSON.stringify(name));
		this.reductionId = name.reductionId;
	} else {
		throw new Error("Production or DottedProduction was expected.");
	}
};

/**
 *
 * @returns {number} the new dot position if the dot could be advanced, or 0 if it could not be.
 */
DottedProduction.prototype.advance = function () {
	return !this.atEnd() ? ++this.dot : 0;
};

/**
 * Returns the symbol to the right of the dot, or null if at end of RHS.
 * @returns {*}
 */
DottedProduction.prototype.getSymbol = function () {
	return this.production.rhs[this.dot];
};

DottedProduction.prototype.copy = function copy() {
	return new DottedProduction(this);
};

DottedProduction.prototype.atBeginning = function atBeginning() {
	return this.dot === 0;
};

DottedProduction.prototype.atEnd = function atEnd() {
	return this.dot === this.production.rhs.length;
};

DottedProduction.prototype.toString = function () {
	var copy = this.production.rhs.slice(0);
	copy.splice(this.dot, 0, ".");
	return this.production.name + " -> " + copy.join(" ");
};

/**
 *
 * @constructor
 * @param dottedProductions - an Array of dottedProduction.
 */
var Kernel = function Kernel(dottedProductions) {
	this.dottedProductions = [];
	var self = this;
	dottedProductions.forEach(function (dp) {
		self.dottedProductions.push(new DottedProduction(dp));
	});
};

Kernel.prototype.push = function push(dottedProduction) {
	if (!dottedProduction instanceof DottedProduction) throw new Error("Kernal.push expects a dottedProduction");
	this.dottedProductions.push(dottedProduction);
};

Kernel.prototype.isEmpty = function isEmpty() {
	return this.dottedProductions.length === 0;
};

var Grammar = function Grammar(productions, start, artificial) {
	this.productions = [];
	this.start = artificial || "S'"; // Note the artificial state is becoming the start state.
	this.addProduction(new Production(this.start, [start ? start : productions[0].name]));

	// Since the grammar is not defined 'by name' (that is A->b and A->c are two separate productions)
	// Find all individual productions that produce epsilon and make sure all productions with the same
	// name are so marked. This is clunky but in the LALR table construction having A->[b,c] is not helpful.

	//// Find all the epsilon productions. Since they don't consume input, they are invalid and should be removed.
	//// However, the fact that a production may produce epsilon needs to be spread to all other productions with
	//// the same name.
	//var epsilons = [];
	//productions.forEach(function(p){ if (p.epsilon) epsilons.push(p.name);});
	//
	//// Remove the p->epsilon productions as they aren't helpful.
	//var properProductions = productions.filter(function(p) {return !p.epsilon;});
	//
	//// Now mark the remaining normal productions as 'can produce epsilon'
	//properProductions.forEach(function(p){
	//	if (epsilons.indexOf(p.name) !== -1) p.epsilon = true;
	//});
	//
	//var self = this;
	//properProductions.forEach(function (p) {
	//	self.addProduction(p);
	//});
	var self = this;
	productions.forEach(function(p){
		self.addProduction(p);
	});
};

Grammar.prototype.addProduction = function (production) {
	production.reductionId = this.productions.length;
	this.productions.push(production);
};

Grammar.prototype.startingKernal = function () {
	var prod = this.findByName(this.start)[0];
	var artificial = new DottedProduction(prod);
	var kernel = new Kernel([artificial]);
	return kernel;
};

Grammar.prototype.findByName = function findByName(nonterminal) {
	var res = this.productions.filter(function (p) {
		return p.name === nonterminal;
	});
	return res;
};

var Itemset = function Itemset(kernel) {
	if (!kernel instanceof Kernel) throw new Error("assert Itemset requires a kernel");
	this.kernel = kernel;
	this.stringifiedKernel = JSON.stringify(kernel);
	this.dottedProductions = [];
	this.id = Itemset.idGen++;
};

Itemset.idGen = 0;

Itemset.prototype.exists = function exists(dProdToFind) {
	var tmp = JSON.stringify(dProdToFind);
	for (var i = 0; i < this.dottedProductions.length; i++) {
		if (JSON.stringify(this.dottedProductions[i]) === tmp) return true;
	}
	return false;
};

Itemset.prototype.fillOut = function fillOut(itemsets, grammar) {
	var queue = [];
	this.kernel.dottedProductions.forEach(function (dotted) {
		queue.push(dotted);
	});
	while (queue.length > 0) {
		var dotted = queue.shift();

		if (!this.exists(dotted)) { //} && dotted.getSymbol()) {
			this.dottedProductions.push(dotted);
			var symbol = dotted.getSymbol();

			// The lack of a symbol means we have progressed to the end of the production. There will be nothing to fill
			// out. Since we've added the dotted production to the list of dotted productions, we're done. Bail out to
			// show this is a special case.
			if (!symbol) continue;

			// if non-term
			if (isNonterm(symbol)) {
				var p = grammar.findByName(symbol);
				p.forEach(function (oneProd) {
					var dp = new DottedProduction(oneProd);
					dp.reductionId = oneProd.reductionId;
					queue.push(dp);
				});
			}
		}
	}
	this.createMoreItemsets(itemsets, grammar);
};

Itemset.createFromKernel = function createFromKernel(itemsets, kernel, grammar) {
	var kernelExists = itemsets.exists(kernel);
	if (kernelExists >= 0) return kernelExists;
	var itemset = new Itemset(kernel);
	itemsets.add(itemset);
	itemset.fillOut(itemsets, grammar);
	return itemset.id;
};

/**
 *
 * @returns a hash of unique symbols
 */
Itemset.prototype.findCurrentSymbols = function findCurrentSymbols() {
	var self = this;
	var dedup = {};
	this.dottedProductions.forEach(function (dProd) {
		var symb = dProd.getSymbol();
		if (symb) dedup[symb] = -1;
	});
	return dedup;
};

Itemset.prototype.findBySymbol = function findBySymbol(symbol) {
	return this.dottedProductions.filter(function (dp) {
		return dp.getSymbol() === symbol;
	});
};

Itemset.prototype.createMoreItemsets = function createMoreItemsets(itemsets, grammar) {
	// These are all the symbols that transition from this itemset
	this.symbs = this.findCurrentSymbols();
	var self = this;
	Object.keys(this.symbs).forEach(function (s) {
		var kernel = new Kernel([]);
		var productions = self.findBySymbol(s);
		productions.forEach(function (p) {
			var copy = p.copy();
			if (copy.advance()) kernel.push(copy);
		});
		if (!kernel.isEmpty()) self.symbs[s] = Itemset.createFromKernel(itemsets, kernel, grammar);
	});
};

Itemset.prototype.toString = function toString() {
	return JSON.stringify(this);
};

Itemset.prototype.startsWithANonterm = function () {
	var res = false;
	this.kernel.dottedProductions.forEach(function (dp) {
		res = isNonterm(dp.getSymbol());
	});
	return res;
};

Itemset.prototype.nice = function nice() {
	var out = "";
	out += this.id + ".\n";
	var self = this;
	var first = true;
	Object.keys(this.symbs).forEach(function (s) {
		if (!first) out += ", ";
		first = false;
		out += s + " : " + self.symbs[s];
	});
	out += "\n";
	this.dottedProductions.forEach(function (dp) {
		out += dp.production.name + " -> ";
		for (var i = 0; i < dp.production.rhs.length; i++) {
			if (dp.dot === i) out += ".";
			out += dp.production.rhs[i];
		}
		if (dp.dot === dp.production.rhs.length) out += ".";
		out += "\n";
	});
	return out;
};

var Itemsets = function Itemsets(logger) {
	this.itemsets = [];
	this.nonterminals = undefined;
	this.first = undefined;
	this.follow = undefined;
	this.logger = logger || console;
};

Itemsets.prototype.add = function add(itemset) {
	if (!itemset instanceof Itemset) throw new Error("#Itemsets.add requires an Itemset");
	this.itemsets.push(itemset);
	var name = itemset.name;
};

Itemsets.prototype.exists = function exists(kernel) {
	var tmp = JSON.stringify(kernel);
	for (var i = 0; i < this.itemsets.length; i++) {
		if (this.itemsets[i].stringifiedKernel === tmp) return i;
	}
	return -1;
};

Itemsets.prototype.calcSortedSymbols = function () {
	var terms = {"$": true};
	var nonterms = {};
	for (var i = 0; i < this.itemsets.length; i++) {
		var symbs = Object.keys(this.itemsets[i].symbs);
		for (var j = 0; j < symbs.length; j++) {
			var s = symbs[j];
			if (isNonterm(s)) nonterms[s] = s;
			else terms[s] = s;
		}
	}
	this.sortedSymbols = [].concat(Object.keys(terms).sort()).concat(Object.keys(nonterms).sort());
};

/**
 * Return a printable string of goodness.
 */
Itemsets.prototype.toString = function () {
	var s = "";
	var add = function (x) {
		s += x + "\n";
	};
	add("itemsets");
	this.itemsets.forEach(function (itemset) {
		add(itemset.id + ".");
		itemset.dottedProductions.forEach(function (dottedProduction) {
			add("\t" + dottedProduction.toString());
		});
	});

	add("first sets");
	var self = this;
	Object.keys(this.first).forEach(function (f) {
		add("\t" + f + " : " + self.first[f].join(","));
	});

	add("follow sets");
	Object.keys(this.follow).forEach(function (f) {
		add("\t" + f + " : " + self.follow[f].join(","));
	});

	return s;
};

Itemsets.prototype.findNonterminals = function () {
	var nts = [];
	this.itemsets.forEach(function (itemset) {
		itemset.dottedProductions.forEach(function (dp) {
			var name = dp.production.name;
			if (nts.indexOf(name) < 0) nts.push(name);
		});
	});
	this.nonterminals = nts;
};
/**
 * The first() of an itemset is every terminal that can be reached with no input.
 * @return {Object}        {nonTerm, [tokens])
 */
Itemsets.prototype.calcFirst = function () {
	var first = {};
	var x = [];

	// bug this section (next 12 lines or so) looks like I didn't understand how javascript data structures work.

	// Find all the dotted prods in this list where the dot it at the beginning. This is the
	// same as the kernel, I believe.  I thought I had the kernel. Why am I not using it? //TODO
	this.itemsets.forEach(function (i) {
		i.dottedProductions.forEach(function (dp) {
			if (dp.atBeginning()) x.push(dp.production);
		});
	});

	// Now find the dedupped names of the productions.
	var z = {};
	x.forEach(function (y) {
		if (!z[y.name]) z[y.name] = [];
		z[y.name].push(y);
	});

	var add = function (name, symbol) {
		if (first[name].indexOf(symbol) < 0) first[name].push(symbol);
	};
	var rec = function (name, prods) {
		// Only act if the name is unknown.
		if (!first[name]) {
			first[name] = [];	// prepare a spot for the first symbols to land.
			prods.forEach(function (p) {
				var symbol = p.rhs[0];
				if (p.rhs.length === 0) { // epsilon
					// ignore this
				} else if (isTerm(symbol)) {
					add(name, symbol);
				}
				// TODO I am not sure why I'd need the following code, so I commented it out. The point of this routine
				// is to find all the terminals at the beginning of a production. Itemsets are built to do this work.
				// There is nothing new that can be added by traversing non-terms. We produced the itemsets by doing
				// that already.
				else { // It is a non-terminal...
					// If this non-term is not already known, make it known.
					if (!first[symbol]) {
						rec(symbol, z[symbol]);
					}
					first[symbol].forEach(function (ns) {
						add(name, ns);
					});
					// I probably need to add code here so that if the first symbol is a non-term that produces
					// epsilon, the next symbol needs to be added too.
				}
			});
		}
	};

	for (var prodName in z) {
		rec(prodName, z[prodName]);
	}

	this.first = first;
}
;

/**
 * The follow() of an itemset includes every terminal that follows it, and every terminal that
 * is in the first() of non-terminals that follow it.  Note that if epsilons are involved, the fun
 * keeps on going!
 * @return {Object}  {nonTerm, [tokens]}
 */
Itemsets.prototype.calcFollow = function (grammar) {
	if (!this.first) throw new Error("First() must be calculated first");

	var nonterms = [];
	// Find all non-terminals in the language.
	this.itemsets.forEach(function (itemset) {
		itemset.dottedProductions.forEach(function (dp) {
			var prod = dp.production;
			if (nonterms.indexOf(prod.name) < 0) nonterms.push(prod.name);
			for (var i = 0; i < prod.rhs.length; i++) {
				var symbol = prod.rhs[i];
				if (isNonterm(symbol)) {
					if (nonterms.indexOf(symbol) < 0) nonterms.push(symbol);
				}
			}
		});
	});

	var self = this;
	self.follow = [];

	var add = function (self, nonterm, thingToAdd) {
		if (!self.follow[nonterm]) self.follow[nonterm] = [];
		if (typeof thingToAdd === 'string') {
			if (self.follow[nonterm].indexOf(thingToAdd) < 0) self.follow[nonterm].push(thingToAdd);
		} else {
			thingToAdd.forEach(function (symbol) {
				if (self.follow[nonterm].indexOf(symbol) < 0) self.follow[nonterm].push(symbol);
			});
		}
	};

	// Add the artificial start by hand.  Since it appears nowhere in a RHS, we'll never add it properly.
	// bug I do not like this though I do not know that it is wrong.
	add(this, grammar.start, "$");

	if (!self.follow) throw new Error("wut?");

	var rec = function (nonterm) {
		self.itemsets.forEach(function (itemset) {
			itemset.dottedProductions.forEach(function (dp) {
				if (dp.dot === 0) {	// As the dot moves, the symbols don't change. Don't calculate except the first time.
					var prod = dp.production;
					for (var i = 0; i < prod.rhs.length; i++) {
						var symbol = prod.rhs[i];
						if (symbol === nonterm) {
							var nextSymbol = prod.rhs[i + 1];
							if (nextSymbol) { // We have found a non-term that is not at the end of a production
								if (isTerm(nextSymbol)) {
									add(self, symbol, nextSymbol);
								} else {
									add(self, symbol, self.first[nextSymbol]);
								}
							} else { // We have found a non-term that IS at the end of a production.
								if (!self.follow[dp.production.name]) {
									rec(dp.production.name);
								}
								add(self, symbol, self.follow[dp.production.name]);
							}
						}
					}
				}
			});
		});
	};

	// Do it one nonterm at a time. This causes more iterating over the itemsets but allows us to
	// recurse somewhat more elegantly. Not much, but some.
	nonterms.forEach(function (t) {
		rec(t);
	});
};

var action = require("./action");
var ShiftAction = action.ShiftAction;
var GotoAction = action.GotoAction;
var InvalidAction = action.InvalidAction;
var AcceptAction = action.AcceptAction;
var ReduceAction = action.ReduceAction;

Itemsets.prototype.buildTable = function () {
	this.table = [];
	var self = this;
	if (!this.sortedSymbols) this.calcSortedSymbols();

	for (var i = 0; i < this.itemsets.length; i++) {
		var x = this.itemsets[i];

		// fill in the shifts
		self.table[x.id] = {};
		this.sortedSymbols.forEach(function (s) {
			var o = x.symbs[s];
			var action = o ? isTerm(s) ? new ShiftAction(o) : new GotoAction(o) : new InvalidAction();
			self.table[x.id][s] = action;
		});

		// Fill in the reductions. We only need the kernel because we're looking for dots that are off the RH end.
		// No other productions in the itemset can have a dot as advanced as the dot in the kernel.
		/*
		 for each dotted production DP in the kernel
		 If the dot is at the RH end
		 For all symbols S in follow(DP.name)
		 if table[x.id][s] has an entry, complain about an ambiguity.
		 set table[x.id][s] = DP.reductionID
		 */
		x.dottedProductions.forEach(function (dp) {
			if (dp.atEnd()) {
				var symbs = self.follow[dp.production.name];
				for (var i = 0; i < symbs.length; i++) {
					self.table[x.id] = self.table[x.id] || {}; // bug why is this needed? Should have been handled above.
					var action = dp.reductionId === 0 ? new AcceptAction() : new ReduceAction(dp.reductionId);
					if (!(self.table[x.id][symbs[i]] instanceof InvalidAction)) {
						self.logger.log("Ambiguity at ", x.id + "," + symbs[i]);
						self.logger.log("Proposed action is " + action);
						self.logger.log("Current action is " + self.table[x.id][symbs[i]].toString()+" and is being retained.");
					} else {
						self.table[x.id][symbs[i]] = action;
					}
				}
			}
		});
	}
};

var LALR1 = function LALR1() {
};
LALR1.prototype.build = function (prods) {
	var grammar = new Grammar(prods);
	grammar.productions.forEach(function (p) {
		if (typeof p.reductionId === 'undefined') throw new Error("assert - expected all grammar productions to have reduction IDs. " + JSON.stringify(p));
	});

	var itemsets = new Itemsets();

	Itemset.createFromKernel(itemsets, grammar.startingKernal(), grammar);
	itemsets.calcSortedSymbols();
	itemsets.findNonterminals();
	itemsets.calcFirst();
	itemsets.calcFollow(grammar);
	itemsets.buildTable();

	this.sortedSymbols = itemsets.sortedSymbols;
	this.table = itemsets.table;
	this.productions = grammar.productions;
	this.itemsets = itemsets;

	return this;
};

LALR1.prototype.productionsString = function () {
	var s = "";
	for (var i = 0; i < this.productions.length; i++) {
		if (s.length > 0) s += "\n";
		s += this.productions[i].toString();
	}
	return s;
};
LALR1.prototype.tableString = function () {
	var s = ",",
		j;	// comma since the first thing we print are the column labels and we need to skip the row number colunm.

	for (j = 0; j < this.sortedSymbols.length; j++) {
		s += this.sortedSymbols[j] + ",";
	}
	s += "\n";
	for (var i = 0; i < this.table.length; i++) {
		s += i + ",";
		for (j = 0; j < this.sortedSymbols.length; j++) {
			s += this.table[i][this.sortedSymbols[j]].nice() + ",";
		}
		s += "\n";
	}
	return s;
};

module.exports.Production = Production;
module.exports.Grammar = Grammar;
module.exports.LALR1 = LALR1;