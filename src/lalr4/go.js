"use strict";

var argv = require('minimist')(process.argv.slice(2)),
	Reductions = require("./reductions"),
	Token = require("./token"),
	Production = require("./production"),
	LALR1 = require("./lalr1-builder"),
	LALR1Parser = require("./lalr1-parser"),
	StringLogger = require("./string-logger"),
	Lexer = require("./lex1"),
	Context = require("./Context"),
	SymbolTable = require("./symbol-table");

var st = new SymbolTable();

var ifElseReduction = function (context, stack, condPart, truePart, falsePart) {
	var falseLabel = st.makeLabel();
	var endLabel = st.makeLabel();
	context.appendContext(condPart);
	context.appendCode(["goto_if_false", falseLabel, condPart.getHandle()]);
	context.appendContext(truePart);
	if (falsePart) {
		context.appendCode(["goto", endLabel]);
		context.appendCode(["label", falseLabel]);
		context.appendContext(falsePart);
		context.appendCode(["label", endLabel]);
		//todo generate 3-addr here to clue the next phase that the result of the if statement is the false part.
	} else {
		context.appendCode(["label", falseLabel]);
		//todo generate 3-addr here to clue the next phase that the result of the if statement is the true part.
	}
	context.setHandle("(ifElseReduction)");
};

var binop = function (context, stack, op) {
	var first = stack[0].val;	// context for the RHS T
	var second = stack[4].val;	// context for the RHS F

	context.appendContext(first);
	context.appendContext(second);
	var v = st.addId();	// With no (first) argument, makes a temp variable.
	context.appendCode([op, v, first.getHandle(), second.getHandle()], v);
	binopRaw(context, op, first.getHandle(), second.getHandle());
};

/**
 * This doesn't need the operands to be in contexts.
 * @param context
 * @param op
 * @param operand1
 * @param operand2
 * @param immediateCalc
 */
var binopRaw = function (context, op, operand1, operand2, immediateCalc) {
	// Eventually I should be able to check the types on operand 1 and 2 and perform a calculation if they are constants.
	var v = st.addId();	// With no (first) argument, makes a temp variable.
	context.appendCode([op, v, operand1, operand2], v);
	return v;
};

var makeVariableKnown = function (context, stackVal, type, isConstant, constantValue) {
	// If we know the variable, we don't have to make it known again.
	var stEntry = st.get(stackVal);
	var v;
	if (stEntry) {
		v = stEntry.name;
	} else {
		v = st.addId(stackVal, undefined, isConstant, constantValue, type);
	}
	return v;
};

var setSymbolType = function (symbol, type) {
	var stEntry = st.get(symbol);
	stEntry.type = type;
};

var setSymbolArrayBounds = function (symbol, arrayOfBounds) {
	st.setSymbolArrayBounds(symbol, arrayOfBounds);
};

var prods = [
	new Production("PROGRAM", ["PROGRAM", "FUNCTION"], Context.straightCopy),
	new Production("PROGRAM", ["FUNCTION"], Context.straightCopy),
	new Production("FUNCTION", ["func", "id", "(", "AUGMENTED_ARG_LIST", ")", "INITIAL_SLIST"], function (context, stack) {
		var funcName = stack[2].val;
		var funcId = st.get(funcName, "function");
		if (funcId) console.log("warning, function " + funcName + " has been defined more than once.");
//		funcId = st.addId(funcName, undefined, true, undefined, SymbolTable.FUNCTION_TYPE);
		funcId = st.addId(funcName, undefined, undefined, undefined, SymbolTable.FUNCTION_TYPE);
		context.appendCode(["function", funcId, funcName]);

		// Add the function arguments
		context.appendContext(stack[6].val);
		var argumentCount = stack[6].val.d.length;

		// Tack on the explicit (user) arguments.
		var localVariableCount = 0;
		st.array(function (a) {
			if (a.type === SymbolTable.LOCAL_VARIABLE_TYPE || a.type === SymbolTable.NUMERIC_TEMP_TYPE) {
				context.appendCode(["declare", a.name, a.type]);

				localVariableCount++;
			}
		});

		// Now a section for array bounds. There's no reason to have these mixed in with the declarations.
		// That only makes parsing harder.
		st.array(function (a) {
			if (a.isArray && (a.type === SymbolTable.LOCAL_VARIABLE_TYPE || a.type === SymbolTable.NUMERIC_TEMP_TYPE)) {
				a.bounds.forEach(function (arr) {
					context.appendCode(["array", a.name, arr]);
				});
				SymbolTable.calculateArrayIndexMultipliers(a);
			}
		});

		// This is the function body
		context.appendContext(stack[10].val);

		context.appendCode(["assign", st.getReturnVariableName(), stack[10].val.getHandle()]);
		if (localVariableCount > 0) context.appendCode(["pop", localVariableCount]);
		context.appendCode(["end_function", funcName]);
		context.setHandle("(FUNCTION ->func)");
		st.reset();
	}),

	new Production("DECLARATIONS", ["DECLARATIONS", "DECL_TYPE", "DECL_IDS", ";"], function (context, stack) {
		//set the types on all DECL_IDs to DECL_TYPE
		var type = stack[2].val.getHandle();
		var ids = stack[4].val.getHandle().split(",");
		for (var i = 0; i < ids.length; i++) {
			// make a call setting the type for ids[i] to 'type'
			setSymbolType(ids[i], type);
		}
		//pass nothing up
		context.setHandle("");
	}),
	new Production("DECLARATIONS", [""], function (context, stack) {
		// pass nothing up
		context.setHandle("");
	}),
	new Production("DECL_TYPE", ['float'], function (context, stack) {
		context.setHandle(SymbolTable.NUMERIC_TYPE);
	}),
	new Production("DECL_TYPE", ['char'], function (context, stack) {
		context.setHandle(SymbolTable.CHAR_TYPE);
	}),
	new Production("DECL_IDS", ["DECL_IDS", ",", "DECL_ID"], function (context, stack) {
		// Pass a list of IDs upward
		var out = stack[0].val.getHandle() + "," + stack[4].val.getHandle();
		context.setHandle(out);
	}),
	new Production("DECL_IDS", ["DECL_ID"], function (context, stack) {
		context.setHandle(stack[0].val.getHandle());
	}),
	new Production("DECL_ID", ["id", "ARRAY_STUFF"], function (context, stack) {
		// add the id to the symbol table,...
		var v = makeVariableKnown(context, stack[0].val, SymbolTable.LOCAL_VARIABLE_TYPE, false);

		// ...and set its bounds and dimensions
		if (stack[2].val.getHandle() !== "") {
			var arr = stack[2].val.getHandle().split(",");	// TODO It would be better if context accepted arbitrary data so I didn't feel compelled to pass strings around.
			setSymbolArrayBounds(v, arr);
		}
		// pass the id up
		context.setHandle(v);
	}),
	new Production("ARRAY_STUFF", ["ARRAY_STUFF", "[", 'integer_numeric', "]"], function (context, stack) {
		// pass the arraystuff (if there's anything)  + the integer up
		var out = "";
		if (stack[0].val.getHandle() !== "") {
			out = stack[0].val.getHandle() + ",";
		}
		out += stack[4].val;
		context.setHandle(out);
	}),
	new Production("ARRAY_STUFF", [""], function (context, stack) {
		// pass nothing up
		context.setHandle("");
	}),


	new Production("AUGMENTED_ARG_LIST", ["ARG_LIST"], function (context, stack) {
		var returnVar = st.getReturnTemp([]);
		context.appendContext(stack[0].val);
		context.appendCode(["arg", returnVar, SymbolTable.RETURN_VARIABLE_TYPE]);
		// When AUGMENTED_ARG_LIST is reduced away as part of FUNCTION above, we have a hook to the return variable.
		context.setHandle(returnVar);
	}),
	new Production("ARG_LIST", ["ONE_OR_MORE_ARGS"], Context.straightCopy),
	new Production("ARG_LIST", [""], function (context, stack) {
		context.handle = "(ARG_LIST -> epsilon)";
	}),
	new Production("ONE_OR_MORE_ARGS", ["ONE_OR_MORE_ARGS", ",", "id"], function (context, stack) {
		context.appendContext(stack[0].val);
		var v = makeVariableKnown(context, stack[4].val, SymbolTable.ARGUMENT_VARIABLE_TYPE, true);	// Calling this a constant since I am thinking it should be pass-by-value
		context.appendCode(["arg", v, stack[4].val], "(ONE_OR_MORE_ARGS -> ONE_OR_MORE_ARGS)");
	}),
	new Production("ONE_OR_MORE_ARGS", ["id"], function (context, stack) {
		var v = makeVariableKnown(context, stack[0].val, SymbolTable.ARGUMENT_VARIABLE_TYPE, true);	// Calling this a constant since I am thinking it should be pass-by-value
		context.appendCode(["arg", v, stack[0].val], "(ONE_OR_MORE_ARGS->id)");
	}),
	new Production("INITIAL_SLIST", ["DECLARATIONS", "S"], Context.straightCopy),
	new Production("INITIAL_SLIST", ["{", "DECLARATIONS", "L", "}"], Context.straightCopy),
	new Production("SLIST", ["S"], Context.straightCopy),
	new Production("SLIST", ["{", "L", "}"], Context.straightCopy),
	new Production("L", ["S"], Context.straightCopy),
	new Production("L", ["L", "S"], function (context, stack) {
		context.appendContext(stack[0].val);
		context.appendContext(stack[2].val);
		context.setHandle(stack[2].val.getHandle());
	}),
	new Production("S", ["if", "(", "EXPR", ")", "SLIST"], function (context, stack) {
		ifElseReduction(context, stack, stack[4].val, stack[8].val, undefined);
	}),
	new Production("S", ["if", "(", "EXPR", ")", "SLIST", "else", "SLIST"], function (context, stack) {
		ifElseReduction(context, stack, stack[4].val, stack[8].val, stack[12].val);
	}),
	new Production("S", ["EXPR", ";"], Context.straightCopy),
	new Production("S", ["id", "=", "EXPR", ";"], function (context, stack) {
		var RHExpression = stack[4].val;
		context.appendContext(RHExpression);
		var v = makeVariableKnown(context, stack[0].val, SymbolTable.LOCAL_VARIABLE_TYPE, false);
		/** It would be possible at this point to check to see if stack[0].val was already known and to throw
		 * an exception if it is a constant. For example, if arguments are pass-by-value, then it could be
		 * argued that a warning should be issued if the argument appears on the LHS.
		 */

		/**
		 * Just adding the assign statement works. Bit all too frequently we end up with something like
		 * MULT, tmp, 1, 2
		 * ASSIGN v, TMP
		 * So instead of adding the spurious ASSIGN, subvert the previous MULT (or whatever) so it is
		 * MULT, v, 1, 2
		 */
		if (!context.backpatch(v))
			context.appendCode(["assign", v, RHExpression.getHandle()], v);
	}),
	new Production("S", ["while", "(", "EXPR", ")", "SLIST"], function (context, stack) {
		var topLabel = st.makeLabel();
		var exitLabel = st.makeLabel();
		var condPart = stack[4].val;
		context.appendCode(["label", topLabel]);
		context.appendContext(condPart);
		context.appendCode(["goto_if_false", exitLabel, condPart.getHandle()]);
		context.appendContext(stack[8].val);
		context.appendCode(["goto", topLabel]);
		context.appendCode(["label", exitLabel]);
		context.setHandle("1:integer_const"); // Warning!  ??? why ???
	}),
	new Production("S", ["do", "SLIST", "while", "(", "EXPR", ")", ";"], function (context, stack) {
		var topLabel = Context.nextLabel();
		var condPart = stack[8].val;
		context.appendCode(["label", topLabel]);
		context.appendContext(stack[2].val);
		context.appendContext(condPart);
		context.appendCode(["goto_if_true", topLabel, condPart.getHandle()]);
		context.setHandle("(from S->do)");
	}),
	new Production("EXPR", ["OR"], Context.straightCopy),
	new Production("OR", ["OR", "||", "AND"], function (context, stack) {
		binop(context, stack, "logical_or");
	}),
	new Production("OR", ["AND"], Context.straightCopy),
	new Production("AND", ["AND", "&&", "NOT"], function (context, stack) {
		binop(context, stack, "logical_and");
	}),
	new Production("AND", ["NOT"], Context.straightCopy),
	new Production("NOT", ["!", "NOT"], function (context, stack) {
		context.appendContext(stack[2].val);
		// bug the next line is wrong
		context.appendCode(["logical_not", Context.nextId(), stack[2].val.getHandle()]);
		context.setHandle("(from NOT -> !)");
	}),
	new Production("NOT", ["COND"], Context.straightCopy),

	new Production("COND", ["COND", ">", "E"], function (context, stack) {
		binop(context, stack, "test_gt");
	}),
	new Production("COND", ["COND", "<", "E"], function (context, stack) {
		binop(context, stack, "test_lt");
	}),
	new Production("COND", ["COND", ">=", "E"], function (context, stack) {
		binop(context, stack, "test_ge");
	}),
	new Production("COND", ["COND", "<=", "E"], function (context, stack) {
		binop(context, stack, "test_le");
	}),
	new Production("COND", ["COND", "==", "E"], function (context, stack) {
		binop(context, stack, "test_eq");
	}),
	new Production("COND", ["COND", "!=", "E"], function (context, stack) {
		binop(context, stack, "test_ne");
	}),
	new Production("COND", ["E"], Context.straightCopy),
	new Production("E", ["E", "+", "T"], function (context, stack) {
		binop(context, stack, "add");
	}),
	new Production("E", ["E", "-", "T"], function (context, stack) {
		binop(context, stack, "subtract");
	}),
	new Production("E", ["T"], Context.straightCopy),
	new Production("T", ["T", "*", "UNARY"], function (context, stack) {
		binop(context, stack, "mult");
	}),
	new Production("T", ["T", "/", "UNARY"], function (context, stack) {
		binop(context, stack, "div");
	}),
	new Production("T", ["UNARY"], Context.straightCopy),
	new Production("UNARY", ["+", "F"], Context.straightCopy),
	new Production("UNARY", ["-", "F"], function (context, stack) {
		var first = stack[2].val;

		context.appendContext(first);
		var zero = makeVariableKnown(context, "0", SymbolTable.INTEGER_CONST_TYPE, true, 0);
		var v = st.addId();
		context.appendCode(["subtract", v, zero, first.getHandle()], v);
	}),
	new Production("UNARY", ["F"], Context.straightCopy),
	new Production("F", ["id", "OPTIONAL_INDICES"], function (context, stack) {
		var v;
		if (stack[2].val.getHandle === "") {
			// check ID to ensure it is not an array.
			// ID is a scalar
			v = makeVariableKnown(context, stack[0].val, SymbolTable.LOCAL_VARIABLE_TYPE, false);
			context.setHandle(v);
		} else {
			// ID is an array. It ought to already exist.
			v = st.get(stack[0].val);
			if (!v) {
				console.log("Error, id " + stack[0].val.getHandle() + " was expected to be in the symbol table.");
				context.setHandle("0");
			} else {
				if (!v.isArray) {
					console.log("Error, id " + stack[0].val.getHandle() + " is not an array but is being used as one");
					context.setHandle("0"); // Let things roll. Maybe. Dunno.
				} else {
					// It was used like an array, and is an array. This is good.  Now to unwind the indices.
					var ind = stack[2].val.getHandle().split(",");
					if (ind.length !== v.bounds.length) {
						console.log("Error, wrong number of array indices for " + v + ". Saw " + ind.length + ", expected " + v.bounds.length);
						context.setHandle("0");
					} else {

						context.appendContext(stack[2].val);

						// At this point we can do bounds checking (sometimes) and perform the offset calculation
						// for the intermediate code.

						var sum = st.addId();
						if (!v.boundsMult) SymbolTable.calculateArrayIndexMultipliers(v);
						for (var i = 0; i < v.bounds.length; i++) {
							var tmp = binopRaw(context, "mult", ind[i], v.boundsMult[i]);
							if (i === 0) {
								context.appendCode(["assign", sum, tmp], sum);
							} else {
								context.appendCode(["add", sum, sum, tmp], sum);
							}
						}
						context.appendCode(["get the base addr for " + stack[0].val + " from the stack"]);
						context.appendCode(["calculate the indirect address"]);
						tmp = binopRaw(context, "add", "(" + stack[0].val + ")", sum);

						context.setHandle(tmp);
					}
				}
			}
		}
	}),
	new Production("F", ["integer_numeric"], function (context, stack) {
		//var v = stack[0].val + ":" + SymbolTable.INTEGER_CONST_TYPE;
		var v = st.addId(undefined, undefined, true, stack[0].val);
		context.setHandle(v);
	}),
	new Production("F", ["floating_numeric"], function (context, stack) {
//		var v = stack[0].val + ":" + SymbolTable.FLOATING_CONST_TYPE;
		var v = st.addId(undefined, undefined, true, stack[0].val);
		context.setHandle(v);
	}),
	new Production("F", ["(", "EXPR", ")"], Context.straightCopy),
	new Production("F", ["FUNCTION_CALL"], Context.straightCopy),
	new Production("FUNCTION_CALL", ["id", "(", "OPTIONAL_ARGS", ")"], function (context, stack) {
		//var returnValue = st.getReturnTemp([]);
		context.appendCode(["push_return_arg", 1]);
		context.appendContext(stack[4].val);
		var fname = st.addId(stack[0].val, SymbolTable.FUNCTION_REF_TYPE, true);
		context.appendCode(["call", fname, stack[0].val]);
		// one for each argument excepting the return argument.
		var numberOfArguments = 0;
		for (var i = 0; i < stack[4].val.d.length; i++) {
			if (stack[4].val.d[i][0] === "push_arg_count") {
				numberOfArguments = stack[4].val.d[i][1];
			}
		}
		context.appendCode(["pop", numberOfArguments - 1]); // subtract one - the return value will be cleaned up later
		var v = st.addId();
		context.appendCode(["retval", v]);
		context.setHandle(v);
	}),
	new Production("OPTIONAL_INDICES", ["OPTIONAL_INDICES", "INDICES"], function (context, stack) {
		if (stack[0].val.getHandle() !== "") {
			context.appendContext(stack[0].val);
			context.appendContext(stack[2].val);
			context.setHandle(stack[0].val.getHandle() + "," + stack[2].val.getHandle());
		} else {
			context.appendContext(stack[2].val);
			context.setHandle(stack[2].val.getHandle());
		}
	}),
	new Production("OPTIONAL_INDICES", [""], function (context, stack) {
		context.setHandle("");
	}),
	new Production("INDICES", ["INDICES", "INDEX"], function (context, stack) {
		context.appendContext(stack[0].val);
		context.appendContext(stack[2].val);
		context.setHandle(stack[0].val.getHandle() + "," + stack[2].val.getHandle());
	}),
	new Production("INDICES", ["INDEX"], function (context, stack) {
		context.appendContext(stack[0].val);
		// the above also sets the handle. Which in this case is the 'result' of the math in index. As we
		// collect other indices, we'll append them to the handle with a comma.  This means that at the
		// very top where the identifier appears, we'll have the index values as a comma-sep list in the handle.
	}),
	new Production("INDEX", ["[", "EXPR", "]"], Context.straightCopy),
	new Production("OPTIONAL_ARGS", ["ARGS"], function (context, stack) {
		var tmpContextRows = stack[0].val.d;
		var lastRow = tmpContextRows[tmpContextRows.length - 1];
		context.appendContext(stack[0].val);
		context.appendCode(["push_arg_count", lastRow[2]]);
	}),
	new Production("OPTIONAL_ARGS", [""]),
	new Production("ARGS", ["EXPR"], function (context, stack) {
		context.appendContext(stack[0].val);
		context.appendCode(["push_arg", stack[0].val.getHandle(), 2], stack[0].val.getHandle());
	}),
	new Production("ARGS", ["ARGS", ",", "EXPR"], function (context, stack) {
		context.appendContext(stack[0].val);
		context.appendContext(stack[4].val);
		var tmpContextRows = stack[0].val.d;
		var lastRow = tmpContextRows[tmpContextRows.length - 1];
		context.appendCode(["push_arg", stack[4].val.getHandle(), lastRow[2] + 1], stack[4].val.getHandle());
	})
];
var patterns = [
	['white', /^\s+/],
	[undefined, /^(if|for|while|else|func|&&|\|\||>|<|>=|<=|==|!=|float|char|\[|])/],
	['id', /^[A-Za-z]+\w*/],
	['floating_numeric', /^\d+\.\d*/],
	['floating_numeric', /^\d*\.\d+/],
	['integer_numeric', /^\d+/],
	[undefined, /^[!-~]/]
];

var fs = require("fs");

var infile = argv.i;
if (!infile) throw new Error("Input file is not specified. use -i");

var outfile = argv.o;
if (!outfile) throw new Error("Output file is not specified. use -o");

var infileData = fs.readFileSync(infile, {encoding: 'utf8'});

var inputStream = new Lexer().lex(patterns, infileData);

var logger = new StringLogger();

var lalr1 = new LALR1().build(prods);

var reductions = new Reductions(logger);
var parser = new LALR1Parser(logger);
var options = {
	showStack: 0,
	showTable: 0,
	showProductions: 1,
	pTerse: 1,
	rTerse: 1,
	noParse: 0,
	showItemsets: 1,
	showFirstAndFollow: 0
};
var result = parser.parse(lalr1, inputStream, reductions, options);
console.log("----");
console.log(logger.out());
console.log("*************************");
//result = parser.opt(result);
//if (result) console.log(result.toString());
if (!options.noParse) fs.writeFileSync(outfile, result.toString(), {encoding: 'utf8'});