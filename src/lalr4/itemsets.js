"use strict;"

var Util = require("./util");

//var productions = [];

/**
 * An Item is basically a production with a 'dot' marking the progress through the production.
 * @param itemOrProd
 * @constructor
 */
var Item = function (itemOrProd) {
	if (itemOrProd instanceof Item) {
		this.prod = itemOrProd.prod;
		this.dot = itemOrProd.dot;
	} else {
		// Assume it's a production
		this.prod = itemOrProd;
		this.dot = 0;
	}
};
Item.prototype.symb = function () {
	return this.prod.rhs[this.dot];
};
Item.prototype.canBeAdvanced = function () {
	return this.dot !== this.prod.rhs.length;
};
Item.prototype.advance = function () {
	if (this.canBeAdvanced()) {
		this.dot++;
		if (this.dot > this.prod.rhs.length) throw new Error("Assert, dot was moved too far");
		return true;
	}
	return false;
};
Item.prototype.toString = function () {
	var s = this.prod.name + " ->";
	for (var i = 0; i < this.prod.rhs.length; i++) {
		if (i === this.dot) s += " .";
		s += " " + this.prod.rhs[i];
	}
	if (this.dot === this.prod.rhs.length) s += " .";
	return s;
};

//*************************************************************************************

/**
 * kernel is an array of type Item
 * The byCurrent[x] structure is a little weird. We have a number of relatively unrelated items in
 * an itemset. However, it is possible that the same input character (or stack symbol) will be recognized
 * by the 'dotted' character in multiple items.  For example, consider these two items:
 * A -> ab.cD
 * B -> ab.cE
 * They are clearly different productions. Progress to this point has been factored into the current
 * itemset. since the dotted character for each is "c", they are grouped together under byCurrent["c"]...
 * All items under a single byCurrent will by definition transition to the same itemset.  In THAT itemset,
 * however, we have these items:
 * A -> abc.D
 * A -> abc.E
 * Now the productions have become different. One will be organized under byCurrent["D"] and the other under
 * byCurrent["E"].
 *
 * @type {Function}
 */
var Itemset = function (_kernel) {
	if (!_kernel) throw new Error("Assertion - expected new Itemset() to be passed a kernel");
	this.id = Itemset.itemsetId++;
	this.kernel = _kernel || [];
	this.byCurrent = {};
};

Itemset.itemsetId = 0;
Itemset.prototype.add = function (item) {
	var symb = item.symb() || "";
	this.byCurrent[item.symb()] = this.byCurrent[item.symb()] || {items: [], transitionTo: undefined};
	this.byCurrent[item.symb()].items.push(item);
};
Itemset.prototype.toString = function () {
	var s = "";
	var add = function (x) {
		s = s + (s.length > 0 ? "\n" : "") + x;
	};
	add("i" + this.id);
	var self = this;
	Object.keys(self.byCurrent).forEach(function (symbol) {
		var bc = self.byCurrent[symbol];
		var dest = self.byCurrent[symbol].transitionTo ? " {" + self.byCurrent[symbol].transitionTo.id + "}" : "";
		bc.items.forEach(function (item) {
			add(item.toString() + dest);
		});
	});
	add("\n");
	return s;
};

//*************************************************************************************

var Itemsets = module.exports = function () {
	this.sets = []; // array of type Itemset
};

Itemsets.prototype.push = function (itemset) {
	this.sets.push(itemset);
};

Itemsets.prototype.inItemsets = function (kernel) {
	for (var i = 0; i < this.sets.length; i++) {
		if (JSON.stringify(kernel) === JSON.stringify(this.sets[i].kernel)) {
			return this.sets[i];
		}
	}
	return undefined;
};

Itemsets.prototype.construct = function (productions, kernel) {
	kernel.forEach(function (k) {
		if (!(k instanceof Item)) throw new Error("Assert - expected kernel to be an array of Item");
	});

	// If the given kernel is already present somewhere in itemsets, just return that instance.
	var existingItemset = this.inItemsets(kernel);
	if (existingItemset) return existingItemset;

	var itemset = new Itemset(kernel);  // For now this is the start state.
	this.sets.push(itemset);

	var queue = [];
	var inProgress = {};
	itemset.kernel.forEach(function (k) {
		if (!(k instanceof Item)) throw new Error("Assertion error, expected an Item, saw", k);
		queue.push(k);
	});
	var self = this;
	while (queue.length > 0) {
		var item = queue.splice(0, 1)[0];
		var symb = item.symb();
		itemset.add(item);
		if (Util.isNonterminal(symb) && !inProgress[symb]) {
			inProgress[symb] = symb;
			// find productions with name = symb.
			productions.filter(function (prod) {
				return symb === prod.name;
			}).forEach(function (prod) {
				queue.push(new Item(prod));
			});
		}
	}

	// Now for each unique transition for the itemset... make a new itemset
	Object.keys(itemset.byCurrent).forEach(function (symbol) {
		var bc = itemset.byCurrent[symbol];
		var kernel = [];
		bc.items.forEach(function (item) {
			var nuItem = new Item(item);
			if (nuItem.advance()) kernel.push(nuItem);
		});
		if (kernel.length > 0) bc.transitionTo = self.construct(productions, kernel);
	});

	return itemset;
};

Itemsets.initialKernel = function (prod) {
	return [new Item(prod)];
};

Itemsets.prototype.toString = function () {
	var s = Util.box("Itemsets");
	this.sets.forEach(function (itemset) {
		s += itemset.toString();
	});
	return s;
};

var action = require("./action");
var ShiftAction = action.ShiftAction;
var GotoAction = action.GotoAction;
var InvalidAction = action.InvalidAction;
var AcceptAction = action.AcceptAction;
var ReduceAction = action.ReduceAction;

Itemsets.prototype.buildTable = function (sortedSymbols, follow) {
	this.table = [];
	var self = this;

	for (var i = 0; i < this.sets.length; i++) {
		var itemset = this.sets[i];

		// fill in the shifts
		self.table[itemset.id] = {};
		sortedSymbols.forEach(function (s) {
			var o = itemset.byCurrent[s];
			if (o) o = o.transitionTo.id;
			var action = o ? Util.isTerminal(s) ? new ShiftAction(o) : new GotoAction(o) : new InvalidAction();
			self.table[itemset.id][s] = action;
		});

		// Now LALR(0) reductions. At best!
		var sortedTerminals = sortedSymbols.filter(function(s){return Util.isTerminal(s);});
		var reductions = itemset.byCurrent["undefined"];
		if (reductions) {
			reductions.items.forEach(function (item) {
				for(var i = 0; i<sortedTerminals.length; i++) {
					var symbol = sortedSymbols[i];
					var current = self.table[itemset.id][symbol];
					if (current instanceof InvalidAction && symbol === "$" && item.prod.reductionId === 0) {
						self.table[itemset.id][symbol] = new AcceptAction(item.prod.reductionId);
						break; // BUG hokey. There is surely a more systematic way to place the accept state!
					}
					if (current instanceof InvalidAction) {
						var prodName = item.prod.name;
						var followSymbs = follow.followSet(prodName);
						if (followSymbs && followSymbs.indexOf(symbol) >= 0)
							self.table[itemset.id][symbol] = new ReduceAction(item.prod.reductionId);
					} else {
						console.log("Reduce conflict:\n");
						console.log("For itemset " + itemset.id + " and symbol '" + symbol + "'");
						console.log("Ignoring reduction on rule " + item.prod.reductionId);
						console.log("Retaining " + self.table[itemset.id][symbol].toString());
					}
				}
			});
		}
	}
};