"use strict";

var argv = require('minimist')(process.argv.slice(2)),
	Reductions = require("./reductions"),
	Token = require("./token"),
	Production = require("./production"),
	LALR1 = require("./lalr1-builder"),
	LALR1Parser = require("./lalr1-parser"),
	StringLogger = require("./string-logger"),
	Lexer = require("./lex1"),
	OffsetTable = require("./offset-table"),
	Context = require("./Context");

var patterns = [
	['white', /^\s+/],
	['ext_func_name', /^[A-Za-z]+:function/],
	['const', /^\d+:[a-z]+_const/],
	['label_name', /^\d+:label/],
	['ext_id', /^[0-9A-Za-z_]+:[A-Za-z_]+/],
	['id', /^(argument_return_variable)/],
	[undefined, /^(function|arg|declare|end_function|local_variable|,|assign|label|goto_if_false|goto)/],
	[undefined, /^(numeric_temp|mult|div|add|subtract|push_arg_count|push_arg|push_return_arg|call|pop|retval|result)/],
	[undefined, /^(test_lt|test_eq|test_gt|array)/],
	['id', /^[A-Za-z_]+/],
	['float', /^\d+\.\d*/],
	['float', /^\d*\.\d+/],
	['integer', /^\d+/],
	[undefined, /^[!-~]/]
];

var ot = new OffsetTable();

/**
 * Generate the appropriate lda instruction based upon the type of the argument
 * @param v
 */
var deduceArg = function (v) {
	var e = getEntry(v);
	return e.isConst ? "#$" + e.symbol : "($" + e.offset + ",X)";
};

var deducePushArg = function (v) {
	var e = getEntry(v);
	if (e.type === "argument_return_variable") return "#$0";
	else return deduceArg(v);
};

/**
 * Pull the variable name from the context if necessary.
 * @param aValue
 * @returns {*}
 */
var getVarName = function (aValue) {
	return (aValue instanceof Context) ? aValue.getHandle() : aValue;
};

var getEntry = function (aValue) {
	var e = ot.get(getVarName(aValue));
	return e;
};
var offset = function (v) {
	return getEntry(v).offset;
};

var constPart = function (v) {
	return getEntry(v).symbol;
};

var fmt = function (a, b) {
	return "\t" + a + (b ? "\t" + b : "");
};
var fmtLabel = function (a) {
	return fmtLabelBase(a) + ":";
};
var fmtLabelRef = function (a) {
	return "$" + fmtLabelBase(a);
};
var fmtLabelBase = function (a) {
	var label = a.split(":");
	return "label_" + label[0];
};
var fmtSource = function (sourceLine) {
	return basicComment(sourceLine.clear());
};
var basicComment = function (c) {
	return ";\t" + c;
};
var binop = function (context, stack, op, diag, sourceLine) {
	context.append([fmtSource(sourceLine)]);
	context.append(
		[
			fmt("tsx"),
			fmt("lda", deduceArg(stack[8].val)),
			fmt(op, deduceArg(stack[12].val)),
			fmt("sta", "$" + offset(stack[4].val) + ",X")
		]);
	context.setHandle("(PART - " + diag + ")");
};

var test = function (context, stack, opcode, sourceLine) {
	context.append([fmtSource(sourceLine)]);
	var lid = ot.getRelativeLabel().name;
	context.append(
		[
			fmt("tsx"),
			fmt("lda", "#$1"),	// assume true
			fmt("sta", "$" + offset(stack[4].val) + ",X"),
			fmt("lda", deduceArg(stack[8].val)),
			fmt("cmp", deduceArg(stack[12].val)),
			fmt(opcode, fmtLabelRef(lid)),
			fmt("lda", "#$0"),
			fmt("sta", "$" + offset(stack[4].val) + ",X"),
			fmtLabel(lid)
		]);
	context.setHandle(stack[4].val);
};

var COMMA = ",";
var prods = [
		new Production("PROGRAM", ['FUNCTIONS'], function (context, stack, sourceLine) {
			var labels = {};
			var out = [];
			var input = [];

			// Get the jump to the main function inserted at the top of the code
			context.append([
				fmt('lda', '#$0'),
				fmt('pha'),
				fmt('jsp', fmtLabelRef('main:function')),
				fmt('hlt')
			]);
			context.appendContext(stack[0].val);

			context.setHandle("(PROGRAM)");
			//context.appendContext(newContext);
		}),
		new Production("FUNCTIONS", ["FUNCTIONS", "FUNCTION"], Context.straightCopy),
		new Production("FUNCTIONS", ["FUNCTION"], Context.straightCopy),
		new Production("FUNCTION", ['START_FUNCTION', 'ALL_ARGS_AND_DECLS', 'BODY', 'END_FUNCTION'], function (context, stack, sourceLine) {
			context.appendContext(stack[0].val);
			context.appendContext(stack[2].val);
			context.appendContext(stack[4].val);
			context.appendContext(stack[6].val);
		}),
		new Production("END_FUNCTION", ['end_function', COMMA, 'id'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			context.append([fmt("rts")]);
			context.setHandle(stack[4].val);
		}),
		new Production("START_FUNCTION", ['function', COMMA, 'ext_func_name', COMMA, 'id'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			ot.clearVariables();
			ot.addWithoutOffset(stack[4].val, stack[0].val);
			context.append([
				fmtLabel(stack[4].val)
			]);
			context.setHandle(stack[4].val);
		}),

		new Production("ALL_ARGS_AND_DECLS", ['ALL_ARGS', 'ALL_DECLS', 'ARRAY_DECLS'], function (context, stack, sourceLine) {

			ot.setOffsets();

			var stackFrameVariables = ot.getStackFrameVariables();
			context.append([basicComment("******************************************************************")]);
			context.append([basicComment("* Stack frame information")]);
			stackFrameVariables.forEach(function (variable) {
				context.append([basicComment("* " + variable.usage + "\t" + variable.name + "\toffset:" + variable.offset + (variable.isArray ? "\tbounds:" + variable.dims : ""))]);
			});
			context.append([basicComment("******************************************************************")]);

			// Find out how many local (and temp) variables there are, and decrement the SP by this amount.
			// Basically, create space for them!
			var numberOfTmps = ot.getNumberOfLocals();
			if (numberOfTmps > 0) context.append([
				fmt("tsx"),
				fmt("txa"),
				fmt("sbc", "#$" + numberOfTmps),
				fmt("tax"),
				fmt("txs")
			]);
			context.setHandle("(ALL_ARGS_AND_DECLS)");
		}),
		new Production("ARRAY_DECLS", ['ARRAY_DECLS', 'ARRAY_DECL'], function (context, stack, sourceLine) {
			context.setHandle("(ARRAY_DECLS 1)");
		}),
		new Production("ARRAY_DECLS", ["ARRAY_DECL"], function (context) {
			context.setHandle("(ARRAY_DECLS 2)");
		}),
		new Production("ARRAY_DECL", ['array', COMMA, 'ext_id', COMMA, 'integer'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			var v = stack[4].val;
			var bound = stack[8].val;
			ot.addDim(v, bound);
			context.setHandle("(ARRAY_DECLS)");
		}),
		new Production("ALL_ARGS", ['ARGS'], function (context, stack, sourceLine) {
			if (stack[0].val.getHandle() !== "") {
				ot.orderedAdd(getVarName(stack[0].val), 'arg');
				context.appendContext(stack[0].val);
			}
		}),
		new Production("ARGS", ['ARG', 'ARGS'], function (context, stack, sourceLine) {
			if (stack[2].val.getHandle() !== "") {
				ot.orderedAdd(getVarName(stack[2].val), 'arg');
				context.appendContext(stack[2].val);
			}
			context.setHandle(stack[0].val.getHandle());
			context.appendContext(stack[0].val);
		}),
		new Production("ARGS", [''], function (context, stack, sourceLine) {
			context.setHandle("");
		}),
		new Production("ALL_DECLS", ['DECLS'], function (context, stack, sourceLine) {
			if (stack[0].val.getHandle() !== "") {
				ot.orderedAdd(getVarName(stack[0].val), 'decl');
				context.appendContext(stack[0].val);
			}
		}),
		new Production("DECLS", ["DECL", "DECLS"], function (context, stack, sourceLine) {
			if (stack[2].val.getHandle() !== "") {
				ot.orderedAdd(getVarName(stack[2].val), 'decl');
				context.appendContext(stack[2].val);
			}
			context.setHandle(stack[0].val.getHandle());
			context.appendContext(stack[0].val);
		}),
		new Production("DECLS", [""], function (context, stack, sourceLine) {
			context.setHandle("");
		}),
		new Production("ARG", ['arg', COMMA, 'ext_id', COMMA, 'id'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			//context.appendCode([stack[0].val, stack[4].val, stack[8].val]);
			context.setHandle(stack[4].val);
		}),
		new Production("ARG", ['arg', COMMA, 'ext_id', COMMA, 'argument_return_variable'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			//context.appendCode([stack[0].val, stack[4].val, stack[8].val]);
			context.setHandle(stack[4].val);
		}),
		new Production("ARG", ['arg', COMMA, 'ext_id', COMMA, 'ext_id'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			//context.appendCode([stack[0].val, stack[4].val, stack[8].val]);
			context.setHandle(stack[4].val);
		}),
		new Production("DECL", ['declare', COMMA, "ext_id", COMMA, 'DECL_VAR_TYPES'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			//context.appendCode([stack[0].val, stack[4].val, stack[8].val]);
			context.setHandle(stack[4].val);
		}),
		new Production("DECL_VAR_TYPES", ['numeric_temp'], function (context, stack, sourceLine) {
			context.setHandle(stack[0].val);
		}),
		new Production("DECL_VAR_TYPES", ['local_variable'], function (context, stack, sourceLine) {
			context.setHandle(stack[0].val);
		}),
		new Production("BODY", ["BODY", "PART"], Context.straightCopy),
		new Production("BODY", ["PART"], Context.straightCopy),
		new Production("PART", ["label", COMMA, "label_name"], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			context.append([
				fmtLabel(stack[4].val)
			]);
			context.setHandle(stack[4].val);
		}),
		new Production("PART", ['assign', COMMA, 'EXT_ID', COMMA, 'VARIOUS_RHS'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			var objOff = offset(stack[4].val);
			context.append([
				fmt("tsx"),
				fmt("lda", deduceArg(stack[8].val)),
				fmt("sta", "$" + objOff + ",X")
			]);
			context.setHandle("(PART - const)");
		}),
		new Production("PART", ['test_eq', COMMA, 'ext_id', COMMA, 'VARIOUS_RHS', COMMA, 'VARIOUS_RHS'], function (context, stack, sourceLine) {
			// ext_id(4) = ext_id(8) == ext_id(12)
			test(context, stack, 'beq', sourceLine);
		}),
		new Production("PART", ['test_gt', COMMA, 'ext_id', COMMA, 'VARIOUS_RHS', COMMA, 'VARIOUS_RHS'], function (context, stack, sourceLine) {
			// ext_id(4) = ext_id(8) > ext_id(12)
			test(context, stack, 'bpl', sourceLine);
		}),
		new Production("PART", ['test_lt', COMMA, 'ext_id', COMMA, 'VARIOUS_RHS', COMMA, 'VARIOUS_RHS'], function (context, stack, sourceLine) {
			// ext_id(4) = ext_id(8) < ext_id(12)
			test(context, stack, 'bmi', sourceLine);
		}),
		new Production("PART", ["goto_if_false", COMMA, 'label_name', COMMA, 'EXT_ID'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			context.append([
				fmt("tsx"),
				fmt("lda", "($" + offset(stack[8].val) + ",X)"),
				fmt("beq", fmtLabelRef(stack[4].val))
			]);
			context.setHandle("(PART - goto_if_false)");
		}),
		new Production("PART", ["goto", COMMA, 'label_name'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			context.append([
				fmt("jmp", fmtLabelRef(stack[4].val))
			]);
			context.setHandle("(PART - goto)");
		}),
		new Production("PART", ["mult", COMMA, 'ext_id', COMMA, "VARIOUS_RHS", COMMA, "VARIOUS_RHS"], function (context, stack, sourceLine) {
			binop(context, stack, "mul", "mult", sourceLine);
		}),
		new Production("PART", ["div", COMMA, 'ext_id', COMMA, "VARIOUS_RHS", COMMA, "VARIOUS_RHS"], function (context, stack, sourceLine) {
			binop(context, stack, "div", "div", sourceLine);
		}),
		new Production("PART", ["add", COMMA, 'EXT_ID', COMMA, "VARIOUS_RHS", COMMA, "VARIOUS_RHS"], function (context, stack, sourceLine) {
			binop(context, stack, "adc", "add", sourceLine);
		}),
		new Production("PART", ["subtract", COMMA, 'ext_id', COMMA, "VARIOUS_RHS", COMMA, "VARIOUS_RHS"], function (context, stack, sourceLine) {
			binop(context, stack, "sbc", "subtract", sourceLine);
		}),
		new Production("PART", ['push_return_arg', COMMA, 'integer'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			context.append([
				fmt('lda', "#$0"),
				fmt('tsx'),
				fmt('sta', "$-" + stack[4].val + ",X")
			]);
			context.setHandle("(PART - push_return_arg)");
		}),
		new Production("PART", ['push_arg', COMMA, "VARIOUS_RHS", COMMA, 'integer'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			context.setHandle(stack[4].val.getHandle());
			context.append([
				fmt('lda', deducePushArg(stack[4].val)),
				fmt('tsx'),
				fmt('sta', "$-" + stack[8].val + ",X")
			]);
			context.setHandle("PART - push_arg");
		}),
		new Production("PART", ['push_arg_count', COMMA, 'integer'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			context.append([
				fmt("tsx"),
				fmt("txa"),
				fmt("sbc", "#$" + stack[4].val),
				fmt("tax"),
				fmt("txs")
			]);
			context.setHandle("PART - push_arg_count");
		}),
		new Production("PART", ['call', COMMA, 'ext_func_name', COMMA, 'id'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			context.setHandle(stack[4].val);
			context.append([
				fmt('jsp', fmtLabelRef(stack[4].val))
			]);
		}),
		new Production("PART", ['pop', COMMA, "integer"], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			context.append([
				fmt("tsx"),
				fmt("txa"),
				fmt("adc", "#$" + stack[4].val),
				fmt("tax"),
				fmt("txs")
			]);
			context.setHandle("(POP)");
		}),
		new Production("PART", ['retval', COMMA, 'EXT_ID'], function (context, stack, sourceLine) {
			context.append([fmtSource(sourceLine)]);
			context.append([
				fmt("pla"),
				fmt("tsx"),
				fmt("sta", "$" + offset(stack[4].val) + ",X")
			]);
			context.setHandle(stack[4].val.getHandle());
		}),
		new Production("VARIOUS_RHS", ["const"], function (context, stack, sourceLine) {
			ot.orderedAdd(stack[0].val, "(VARIOUS_RHS)");
			context.setHandle(stack[0].val);
		}),
		new Production("VARIOUS_RHS", ["EXT_ID"], function (context, stack, sourceLine) {
			context.setHandle(stack[0].val.getHandle());
		}),
		new Production("EXT_ID", ["ext_id"], function (context, stack, sourceLine) {
			ot.orderedAdd(stack[0].val, "(VARIOUS_RHS)");
			context.setHandle(stack[0].val);
		})
	]
	;

var fs = require("fs");

var infile = argv.i;
if (!infile) throw new Error("Input file is not specified. use -i");

var outfile = argv.o;
if (!outfile) throw new Error("Output file is not specified. use -o");

var infileData = fs.readFileSync(infile, {encoding: 'utf8'});

var inputStream = new Lexer().lex(patterns, infileData);

/*
 2.  find out why the return argument offset(+0) is  evidently  being  used in the  general  function code
 4.  make  the  symbol  table  smarter.knowing  if a variable  is  a  constant  would  be  helpful  as  the  6502 to
 be generated changes if so.
 */

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
//console.log("Symbol table");
//Object.keys(symbolTable).forEach(function (k) {
//	var stRow = symbolTable[k];
//	console.log(k + ": " + stRow.name + " " + stRow.type + " " + stRow.offset);
//});

//if (result) {
//	for (var i = 0; i < result.d.length; i++) {
//		console.log('"' + result.d[i] + '",');
//	}
//}

fs.writeFileSync(outfile, result.toString(), {encoding: 'utf8'});