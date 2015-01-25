var Token = require("./token"),
	action = require("./action"),
	BaseAction = action.BaseAction,
	ShiftAction = action.ShiftAction,
	GotoAction = action.GotoAction,
	InvalidAction = action.InvalidAction,
	AcceptAction = action.AcceptAction,
	ReduceAction = action.ReduceAction;

var LALR1Parser = module.exports = function (logger) {
	this.logger = logger;
};

LALR1Parser.prototype.parse = function (lalr1, input, reductions, options) {
	options = options || {};

	if (options.showTable) this.logger.log(lalr1.tableString());
	if (options.showProductions) this.logger.log(lalr1.productionsString());
	if (options.showItemsets) this.logger.log(lalr1.itemsets);
	if (options.noParse) return undefined;

try {
	var EOI = new Token("$", "$");
	var stack = [new Token(0, 0)];
	var panic = 0;
	var exit = false;
	while (!exit) {
		if (options.showStack) this.logger.log(stack.join(" ")+"   input:"+input);
		if (++panic === 100) throw new Error("Panic. Guru meditation: input: ", input);
		var token = input[0] || EOI;
		var tos = stack[stack.length - 1];
		var action = lalr1.table[tos.parserSymb][token.parserSymb];
		if (!action) throw new Error("Guru meditation: Table entry for (" + tos + ",'" + token + "') is unknown.\nstack:" + stack + "\ninput:" + input + "\ntos:" + tos + "\nn:" + token + "\ns:'" + action + "'");
		if (!action instanceof BaseAction) throw new Error("Guru meditation: Table entry for (" + tos + ",'" + token + "') is of the wrong type.\ndumping it:" + action + "\nstack:" + stack + "\ninput:" + input + "\ntos:" + tos + "\nn:" + token + "\ns:'" + action + "'");
		if (action instanceof ShiftAction) {
			stack.push(token);
			stack.push(new Token(action.val, "??"));
			input = input.slice(1);
		}
		else if (action instanceof AcceptAction) {
			if (token.parserSymb !== "$") throw new Error("Guru meditation: Expected to be at end-of-input.\nstack:" + stack + "\ninput:" + input);
			//this.logger.log("accepted");
			// The only 'accepted' way out of this function is through this exit. Everything else is an exception.
			exit = true;
		}
		else if (action instanceof ReduceAction) {
			var production = lalr1.productions[action.val];		// The production we're reducing by. ex: "A->B C"
			var numberOfSymbols = production.rhs.length * 2;	// The number of stack symbols to devour, x2 because we have to remove state tokens as well as user tokens
			var name = production.name;							// The reduction name. If the reduction is "A->B", then "A"
			var popped = stack.splice(-numberOfSymbols, numberOfSymbols);		// Remove the tokens associated with this reduction
			var newVal = reductions.reduce(action.val, popped, options);		// Invoke the callback with those items removed.
			tos = stack[stack.length - 1];					//
			action = lalr1.table[tos.parserSymb][name];		// Find the action for the LHS (AKA name) of the reduction.
			if (!action instanceof GotoAction) throw new Error("Guru meditation: Expected a GotoAction." + "\naction:" + action.toString() + "\nrow:" + tos.parserSymb + "\ncol:" + name + "\ninput:" + input + "\nstack:" + stack);
			stack.push(new Token(name, newVal));			// This Token contains the user's application information
			stack.push(new Token(action.val, "?"));			// This Token is parser information. In this context 'val' is a row in the table.
		}
		else if (action instanceof GotoAction) {
			throw new Error("Guru meditation: Found GotoAction out of context.\naction:" + action.toString() + "\nrow:" + tos.parserSymb + "\ninput:" + input + "\nstack:" + stack);
		}
		else {
			throw new Error("Guru meditation: unknown table code '" + action + "'. Particulars are\nstack: " + stack + "\ntoken: " + token + "\ninput:" + input);
		}
	}
	// This hurts. But the parser table seems to be correct. I would like the stack to be empty. But that's not
	// how it seems to work! See Dragon, 1977 ed, pg 201, figure 6.3, for an example.
	stack.pop(); // Toss the navigation token
	var result = stack[stack.length - 1].val;
	if (!options.pTerse) this.logger.log("result is *" + result);
	return result;
} catch(err) {
	this.logger.log(err);
	return undefined;
}
};