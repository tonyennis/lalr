var isNonterm = function (s) {
	if (typeof s === 'undefined') return false;
	return s[0] >= "A" && s[0] <= "Z";
};

var isTerm = function (s) {
	return !isNonterm(s);
};

var Production = function Production(name, rhs) {
	this.name = name;
	this.rhs = rhs || [];
};

Production.prototype.copy = function copy() {
	var copy = new Production(this.name);
	copy.rhs = this.rhs.map(function (s) {
		return s
	});
	return copy;
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
	return this.dottedProductions.length == 0;
};

var Grammar = function Grammar(productions, start, artificial) {
	this.productions = [];
	this.start = artificial || "S'"; // Note the artificial state is becoming the start state.
//	this.addProduction(new Production(this.start, [start ? start : productions[0].name, "$"]));
	this.addProduction(new Production(this.start, [start ? start : productions[0].name]));
	var self = this;
	productions.forEach(function (p) {
		self.addProduction(p);
	})
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

//Grammar.prototype.nice = function () {
//	for (var i = 0; i < this.productions.length; i++) {
//		console.log(this.productions[i].toString());
//	}
//};

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
		if (!this.exists(dotted) && dotted.getSymbol()) {
			this.dottedProductions.push(dotted);
			var symbol = dotted.getSymbol();
			if (typeof symbol === 'undefined') throw new Error("missing symbol " + JSON.stringify(dotted));
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
			if (dp.dot == i) out += ".";
			out += dp.production.rhs[i];
		}
		if (dp.dot === dp.production.rhs.length) out += ".";
		out += "\n";
	});
	return out;
};

var Itemsets = function Itemsets() {
	this.itemsets = [];
	this.nonterminals = undefined;
	this.first = undefined;
	this.follow = undefined;
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

	if (this.table) {
		var j,
			t;
		add("Action table");
		t = "   ";
		for (j = 0; j < this.sortedSymbols.length; j++) {
			t += " " + this.sortedSymbols[j] + ",";
		}
		add(t);
		for (var i = 0; i < this.table.length; i++) {
			t = i + ". ";
			for (j = 0; j < this.sortedSymbols.length; j++) {
				t += this.table[i][this.sortedSymbols[j]] + ",";
			}
			add(t);
		}
	}

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

	this.itemsets.forEach(function (i) {
		i.dottedProductions.forEach(function (dp) {
			if (dp.atBeginning()) x.push(dp.production);
		});
	});
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
				if (isTerm(symbol)) {
					add(name, symbol);
				} else { // It is a non-terminal...
					// If this non-term is not already known, make it known.
					if (!first[symbol]) {
						rec(symbol, z[symbol]);
					}
					first[symbol].forEach(function (ns) {
						add(name, ns);
					});
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
							if (nextSymbol) {
								if (isTerm(nextSymbol)) {
									add(self, symbol, nextSymbol);
								} else {
									add(self, symbol, self.first[nextSymbol]);
								}
							} else {
								if (!self.follow[dp.production.name]) {
									rec(dp.name);
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
			var action = isTerm(s) ? "s" : "g";
			self.table[x.id][s] = o ? action + o : "  ";
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
		x.kernel.dottedProductions.forEach(function (dp) {
			if (dp.atEnd()) {
				var symbs = self.follow[dp.production.name];
				for (var i = 0; i < symbs.length; i++) {
					self.table[x.id] = self.table[x.id] || {};
					var reductionId = dp.reductionId === 0 ? "a" : "r" + dp.reductionId;
					if (self.table[x.id][symbs[i]] !== "  ") {
						console.text("Ambiguity at ", x.id, symbs[i]);
						self.table[x.id][symbs[i]] += "," + reductionId;
					} else {
						self.table[x.id][symbs[i]] = reductionId;
					}
				}
			}
		});
	}
};
//
//var LALR1 = function LALR1() {
//};
//LALR1.prototype.build = function (prods) {
//	var grammar = new Grammar(prods);
//	grammar.productions.forEach(function (p) {
//		if (typeof p.reductionId === 'undefined') throw new Error("assert - expected all grammar productions to have reduction IDs. " + JSON.stringify(p));
//	});
//
//	var itemsets = new Itemsets();
//
//	Itemset.createFromKernel(itemsets, grammar.startingKernal(), grammar);
//	itemsets.calcSortedSymbols();
//	itemsets.findNonterminals();
//	itemsets.calcFirst();
//	itemsets.calcFollow(grammar);
//	itemsets.buildTable();
//
//	this.sortedSymbols = itemsets.sortedSymbols;
//	this.table = itemsets.table;
//	this.productions = grammar.productions;
//
//	return this;
//};
//var Token = function Token(parserSymb, val) {
//	this.parserSymb = parserSymb;	// This would be any symbol known to the parser - everything in LALR1.sortedSymbols
//	this.val = val;
//};
//Token.prototype.toString = function () {
//	return "(" + this.parserSymb + "," + this.val + ")";
//};
//Token.makeInputStream = function (s) {
//	var stream = [];
//	s.split("").forEach(function (t) {
//		if (t >= "a" && t <= "z") stream.push(new Token("id", t));
//		else stream.push(new Token(t, t));
//	});
//	return stream;
//};

//LALR1.prototype.productionsString = function() {
//	var s = "";
//	for(var i=0; i<this.productions.length; i++) {
//		if (s.length > 0) s+= "\n";
//		s += this.productions[i].toString();
//	}
//	return s;
//};
//LALR1.prototype.tableString = function () {
//	var s = ",",
//		j;	// comma since the first thing we print are the column labels and we need to skip the row number colunm.
//
//	for (j = 0; j < this.sortedSymbols.length; j++) {
//		s += this.sortedSymbols[j] + ",";
//	}
//	s += "\n";
//	for (var i = 0; i < this.table.length; i++) {
//		s += i + ",";
//		for (j = 0; j < this.sortedSymbols.length; j++) {
//			s += this.table[i][this.sortedSymbols[j]] + ",";
//		}
//		s += "\n";
//	}
//	return s;
//};
//
//LALR1.prototype.parse = function (input, reductions, options) {
//	options = options || {};
//
//	if(options.showTable) console.log(lalr1.tableString());
//	if(options.showProductions) console.log(lalr1.productionsString());
//
//	var EOI = new Token("$", "$");
//	var stack = [new Token(0,0)];
//	var panic = 0;
//	var exit = false;
//	while (!exit) {
//		if(options.showStack) console.log(stack.join(" "));
//		if (++panic === 100) throw new Error("Panic. Guru meditation: input: ",input);
//		var token = input[0] || EOI;
//		var tos = stack[stack.length - 1];
//		var s = this.table[tos.parserSymb][token.parserSymb];
//		if (!s || s == "  ") throw new Error("Guru meditation: Table entry for (" + tos + ",'" + token + "') is unknown.\nstack:" + stack + "\ninput:" + input + "\ntos:" + tos + "\nn:" + token + "\ns:'" + s + "'");
//		if (s[0] == "s") {
//			stack.push(token);
//			stack.push(new Token(s.slice(1), "??"));
//			input = input.slice(1);
//		}
//		else if (s[0] === "a") {
//			if (token.parserSymb !== "$") throw new Error("assert, expected to be and end-of-input");
//			console.log("accepted");
//			exit = true;
//		}
//		else if (s[0] === "r") {
//			var reduceBy = this.productions[s.slice(1)];
//			var p = reduceBy.rhs.length;
//			var rn = reduceBy.name;
//			var popped = stack.splice(-2*p, 2*p);
//			var newVal = reductions.reduce(s.slice(1), popped);		// Invoke the callback with the items removed.
//			tos = stack[stack.length - 1];
//			s = this.table[tos.parserSymb][rn];
//			stack.push(new Token(rn, newVal));
//			stack.push(new Token(s.slice(1), "?"));
//		}
//		else if (s[0] === "g") {
//		}
//		else {
//			throw new Error("Guru meditation: unknown table code '" + s + "'. Particulars are\nstack: " + stack + "\ninput: " + token + "\ninstring:" + instring);
//		}
//	}
//};

//var Reductions = function Reductions() {
//	this.myId = 100;
//	this.reductions = [
//		function(self, stack) { throw new Error("Did not expect to reduce 0. S' -> E");},
//		function(self, stack) { var r = self.myId++; console.log(r+" = *"+stack[0].val+" plus *"+stack[4].val); return r},
//		function(self, stack) { var r = self.myId++; console.log(r+" = *"+stack[0].val+" minus *"+stack[4].val); return r},
//		function(self, stack) { console.log("..."); return stack[0].val},
//		function(self, stack) { var r = self.myId++; console.log(r+" = *"+stack[0].val+" mult *"+stack[4].val); return r},
//		function(self, stack) { var r = self.myId++; console.log(r+" = *"+stack[0].val+" div *"+stack[4].val); return r},
//		function(self, stack) { console.log("..."); return stack[0].val;},
//		function(self, stack) { console.log("..."); return stack[0].val;},
//		function(self, stack) { console.log("..."); return stack[2].val;}
//	];
//};
//
//Reductions.prototype.reduce = function(n, stack) {
//	return this.reductions[n](this, stack);
//};
//
// Start here :-D
var prods = [
	new Production("E", ["E", "+", "T"]),
	new Production("E", ["E", "-", "T"]),
	new Production("E", ["T"]),
	new Production("T", ["T", "*", "F"]),
	new Production("T", ["T", "/", "F"]),
	new Production("T", ["F"]),
	new Production("F", ["id"]),
	new Production("F", ["(", "E", ")"])
];

var lalr1 = new LALR1().build(prods);
var inputStream = Token.makeInputStream("a+(b-c)*d/e");
var reductions = new Reductions();
lalr1.parse(inputStream, reductions, {showStack:0, showTable:1, showProductions:1});



