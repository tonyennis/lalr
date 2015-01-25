"use strict";
var argv = require('minimist')(process.argv.slice(2)),
	Production = require("./production"),
	fs = require("fs"),
	StringLogger = require("./string-logger"),
	LALR1 = require("./lalr1-builder"),
	Reductions = require("./reductions"),
	LALR1Parser = require("./lalr1-parser"),
	Context = require("./Context"),
	Lexer = require("./lex1");

/*
 low-rent assembler for the 6502

 label:
 ; comment
 opcodes start in column >1
 one opcode per line

 The assembler will read the input file and map it to 'words' which are pretty much 1:1 with the elements being produced.
 For example:

 lda ($8,X)
 sbc #$2
 sta $2,X

 will use a total of six words.

 The assembler will also replace usages of labels with relative or relative offsets as appropriate.

 The output will be a stream of words that m3 will process.
 */

var patterns = [
	['white', /^\s+/],
	['label', /^[A-Za-z0-9_]+:/],
	['op1', /^[A-Za-z0-9]+/],
	['op2', /^[#\$\(]\S+/],
	['comment', /^;.*/]	// Need this one to eat until the end of the line but no further
];

var createLabel = function (n) {
	if (labels[n]) return labels[n];
	labels[n] = {
		ref: [],
		name: n,
		addr: undefined
	};
	return labels[n];
};

var normalize = function (n) {
	n = n.replace(":", "");
	n = n.replace("$", "");
	return n;
};
var addLabel = function (n) {
	n = normalize(n);
	var labelRef = createLabel(n);
	labels[n].addr = codes.length;
};

var registerLabelUse = function (n, addr) {
	var labelRef = createLabel(normalize(n));
	labelRef.ref.push(addr);
};
var backfill = function (n, addr) {
	var keys = Object.keys(labels);
	for (var i = 0; i < keys.length; i++) {
		var labelRef = labels[keys[i]];
		for (var j = 0; j < labelRef.ref.length; j++) {
			// determine type of jump
			var b = codes[labelRef.ref[j] - 1];
			if (['jsp', 'jmp'].indexOf(b) >= 0) {
				// absolute jump
				codes[labelRef.ref[j]] = "$" + labelRef.addr;
			} else {
				// relative jumps
				codes[labelRef.ref[j]] = "$" + (labelRef.addr - labelRef.ref[j] + 1);
			}
		}
	}
};

var codes = [];
var labels = {};  // {loc: #, usages:[]}}

var prods = [
		new Production('PROGRAM', ['LINES'], function (context, stack) {
			backfill();
		}),
		new Production('LINES', ['LINES', 'LINE'], Context.straightCopy),
		new Production('LINES', ['LINE'], Context.straightCopy),
		new Production('LINE', ['OPTIONAL_LABEL', 'OPTIONAL_INSTRUCTION'], function (context, stack, options) {
			context.setHandle("line");
		}),
		new Production('OPTIONAL_LABEL', ['label'], function (context, stack, options) {
			var label = stack[0].val;
			addLabel(label);
			context.setHandle("optional_label");
		}),
		new Production('OPTIONAL_LABEL', [''], function (context, stack, options) {
			context.setHandle("no optional label");
			context.appendCode(["x"]);
		}),
		new Production('OPTIONAL_INSTRUCTION', ['op1', 'OPTIONAL_OP2'], function (context, stack, options) {
			codes.push(stack[0].val);
			if (stack[2].val.getHandle().length > 0) {
				codes.push(stack[2].val.getHandle());

				context.setHandle(stack[0].val);
				if (['jsp', 'jmp', 'bmi', 'beq', 'bpl'].indexOf(stack[0].val) >= 0) {
					registerLabelUse(stack[2].val.getHandle(), codes.length - 1);
				}
			}
		}),
		new Production('OPTIONAL_INSTRUCTION', [''], function (context, stack, options) {
			context.setHandle(undefined);
		}),
		new Production('OPTIONAL_OP2', ['op2'], function (context, stack, options) {
			context.setHandle(stack[0].val);
		}),
		new Production('OPTIONAL_OP2', [''], function (context, stack, options) {
			context.setHandle("");
		})
	]
	;

var infile = argv.i;
if (!infile) throw new Error("Input file is not specified. use -i");

var outfile = argv.o;
if (!outfile) throw new Error("Output file is not specified. use -o");


var inData = fs.readFileSync(infile, {encoding: 'utf8'});

var inputStream = new Lexer().lex(patterns, inData);
inputStream = inputStream.filter(function (t) {
	return t.parserSymb !== 'comment';
});

var logger = new StringLogger();

var reductions = new Reductions(logger);
var parser = new LALR1Parser(logger);
var options = {
	showStack: 0,
	showTable: 0,
	showProductions: 0,
	pTerse: 1,
	rTerse: 1,
	noParse: 0,
	showItemsets: 0,
	showFirstAndFollow: 0
};
var lalr1 = new LALR1().build(prods);
var result = parser.parse(lalr1, inputStream, reductions, options);
console.log("----");
console.log(logger.out());
console.log("*************************");

fs.writeFileSync(outfile, codes.join("\n"), {encoding: 'utf8'});


