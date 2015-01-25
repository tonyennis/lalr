/**
 *
 * A 'symbol' is a terminal or nonteminal character such as '(' or 'T'.
 * A production is an object with {name: ..., dot: ..., rhs:[...]}
 * An itemlist is an object with: {name: ..., productions: [...]}
 *
 * @type {{name: string, rhs: string[]}[]}
 */

var g = [
	{name: "S", rhs: ["E"]},
	{name: "E", rhs: ["E", "+", "T"]},
	{name: "E", rhs: ["T"]},
	{name: "T", rhs: ["T", "*", "F"]},
	{name: "T", rhs: ["F"]},
	{name: "F", rhs: ["(", "E", ")"]},
	{name: "F", rhs: ["id"]}
];

/**
 * Returns the symbol on the dot.
 * @param s
 * @returns {*}
 */
var ns = function (p) {
	return p.rhs[p.dot];
};
/**
 * Make a 'deep enough' copy of the given production
 * @param s
 * @returns {{dot: (*|number), rhs: (Array|string|Blob), name: *}}
 */
var copy = function copy(p) {
	return {
		dot: p.dot,
		rhs: p.rhs.slice(0), // copy
		name: p.name};
};
/**
 *
 * @param prodlist
 * @param name
 * @returns {Array of productions}
 */
var findByName = function (prodlist, name) {
	var tmp = prodlist.filter(function (x) {
		return x.name === name;
	});
	return tmp.map(function (t) {
		var c = copy(t);
		// guarantee that there will be a dot attribute.  There isn't when the input itemlist is the original grammar.
		if (typeof c.dot === 'undefined') c.dot = 0;
		return c;
	})
};

var closure = function (grammar, itemlist) {
	if (!itemlist.productions) throw new Error("itemlist is not proper. Saw " + itemlist);
	var newSets = [];

	// These are all the symbols 'on the dot' in this itemlist.
	var symbs = findAllNextSymbs(itemlist);

	symbs.forEach(function (symb) {
		// onDeck is seeded with productions that recognize this symbol.
		var onDeck = findByDotSymb(itemlist, symb),
		//newSet = [],
			seen = [];

		while (onDeck.length > 0) {
			var x = onDeck.shift();
			newSets.push(x);
			var s = ns(x);
			if (seen.indexOf(s) < 0) {
				seen.push(s);
				var prods = findByName(grammar, s);
				if (isNonTerm(s)) {
					prods.forEach(function (f) {
						onDeck.push(f)
					});
				}
			}
		}
	});
	itemlist.productions = newSets;
	return itemlist;
};

var findAllNextSymbs = function findAllNextSymbs(itemlist) {
	var res = [];
	var symbs = itemlist.productions.map(function (x) {
		return ns(x);
	});
	while (symbs.length > 0) {
		var a = symbs.shift();
		// If there is another "a" in the symbs list, dump this one.
		if (symbs.indexOf(a) < 0) res.push(a);
	}
	return res;
};
var findByDotSymb = function findByDotSymb(itemlist, symb) {
	var tmp = itemlist.productions.filter(function (x) {
		return ns(x) === symb;
	});
	// We need a deeper copy since we have to manipulate the dot.
	return tmp.map(function (t) {
		return copy(t);
	});
};
var isNonTerm = function (symb) {
	return "A" <= symb && symb <= "Z";
};
var print = function (itemlist) {
	console.text("-----");
	console.text("name:", itemlist.name);
	if (itemlist.edges) {
		itemlist.edges.forEach(function (e) {
			console.text(e.symbol + " -> " + e.to);
		});
	}
	itemlist.productions.forEach(function (f) {
		console.text("name:", f.name, "dot:", f.dot, "rhs:", f.rhs);
	})
};
var id = 0;
var prodsToItemlist = function prodsToItemlist(prods) {
	var itemset = {
		name: "i" + id++,
		productions: prods
	};
	return itemset;
};

/**
 * This routine advances the productions that have the given symbol 'on the dot'
 * @param grammar
 * @param itemlist
 */
var buildNewItemlist = function buildNewItemlist(grammar, itemlist) {
	newSets = [];
	// These are all the symbols 'on the dot' in this itemlist.
	var symbs = findAllNextSymbs(itemlist);
	symbs.forEach(function (symb) {
		var prods = findByDotSymb(itemlist, symb);
		prods.forEach(function (p) {
			advance(p);
		});
		var x = prodsToItemlist(prods);
		itemlist.edges = itemlist.edges || [];
		itemlist.edges.push({symbol: symb, to: x.name});
		var closure = closure(grammar, x);
		if (doesNotExist(newSets, closure)) {
			newSets.push(closure);
			buildNewItemlist(grammar, closure);
		}
	});
	return newSets;
};
var depleted = function depleted(s) {
	return s.dot >= s.rhs.length;
};

var advance = function advance(s) {
	if (!depleted(s)) s.dot++;
};

this.exports = {

	g: g,
	findByName: findByName,
	copy: copy,
	ns: ns,
	closure: closure,
	findAllNextSymbs: findAllNextSymbs,
	isNonTerm: isNonTerm,
	print: print,
	buildNewItemlist: buildNewItemlist,
	depleted: depleted,
	advance: advance,
	findByDotSymb: findByDotSymb,

	yoinks: function yoinks() {
		// Calculate the first item set from the grammar above. g[0] is the artificial start-state.
		var tmp = findByName(g, "S");
		var itemlists = closure(g, prodsToItemlist(tmp));
		var x = buildNewItemlist(g, itemlists);
		print(itemlists);
		x.forEach(function (xx) {
			print(xx);
		});
	}
};



