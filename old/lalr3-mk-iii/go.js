var Reductions = require("./reductions"),
	Token = require("./token"),
//TokenStream = require("./TokenStream"),
	builder = require("./lalr1-builder"),
	Production = builder.Production,
	LALR1 = builder.LALR1,
	LALR1Parser = require("./lalr1-parser"),
	StringLogger = require("./string-logger"),
	Lexer = require("./lex1"),
	Context = require("./Context");

//var prods = [
//	new Production("L", ["S", ";", "L"]),
//	new Production("L", ["S"]),
//	new Production("S", ["yadda"]),
//	new Production("S", ["allures"]),
//	new Production("S", ["zoot"]),
//	new Production("S", ["if", "(", "E", ")", "then", "L"]),
//	new Production("S", ["if", "(", "E", ")", "then", "L", "else", "L"]),
//	new Production("S", ["id", "=", "E"]),
//	new Production("E", ["E", "+", "T"]),
//	new Production("E", ["E", "-", "T"]),
//	new Production("E", ["T"]),
//	new Production("T", ["T", "*", "F"]),
//	new Production("T", ["T", "/", "F"]),
//	new Production("T", ["F"]),
//	new Production("F", ["G", "^", "F"]),
//	new Production("F", ["G"]),
//	new Production("G", ["id"]),
//	new Production("G", ["(", "E", ")"]),
//	new Production("G", ["id", "(", "A", ")"]),
//	new Production("A", ["E"]),
//	new Production("A", ["A", ",", "E"])
//];
//var inputStream = new Lexer().lex("if ( d * e ) then z = a + b * c ; y = d ( x , y ,  mambo + n * o )");

var ifElseReduction = function (context, stack, options, condPart, truePart, falsePart) {
	var falseLabel = Context.nextLabel();
	var endLabel = Context.nextLabel();
	context.append(condPart);
	context.appendCode([falseLabel, "goto_if_false", condPart.lastResult()]);
	context.append(truePart);
	if (falsePart) {
		context.appendCode([endLabel, "goto"]);
		context.appendCode([falseLabel, "label"]);
		context.append(falsePart);
		context.appendCode([endLabel, "label"]);
	} else {
		context.appendCode([falseLabel, "label"]);
	}
};

var binop = function (context, stack, options, op) {
	var first = stack[0].val;	// context for the RHS T
	var second = stack[4].val;	// context for the RHS F

	context.append(first);
	context.append(second);
	context.appendCode([Context.nextId(), op, first.lastResult(), second.lastResult()]);
};

var prods = [
	new Production("FUNCTION", ["func", "id", "(", "ARG_LIST",  ")", "SLIST"], function(context, stack, options){
		var funcName = stack[2].val;
		var funcId = Context.nextId();
		context.appendCode([funcId, "function", funcName]);
		context.append(stack[6].val);
		context.append(stack[10].val);
		context.appendCode([funcId, "end function", funcName]);
	}),
	new Production("ARG_LIST", ["HAS_ARG_LIST"], Context.straightCopy),
	new Production("ARG_LIST", [""]),
	new Production("HAS_ARG_LIST", ["HAS_ARG_LIST", ",", "id"], function(context, stack, options){
		context.append(stack[0].val);
		context.appendCode([Context.nextId(), "arg", stack[4].val]);
	}),
	new Production("HAS_ARG_LIST", ["id"], function(context, stack, options){
		context.appendCode([Context.nextId(), "arg", stack[0].val]);
	}),
	new Production("SLIST", ["S"], Context.straightCopy),
	new Production("SLIST", ["{", "L", "}"], Context.straightCopy),
	new Production("L", ["S"], Context.straightCopy),
	new Production("L", ["L", "S"], function (context, stack, options) {
		context.append(stack[0].val);
		context.append(stack[2].val);
	}),
	new Production("S", ["if", "(", "EXPR", ")", "then", "SLIST"], function (context, stack, options) {
		ifElseReduction(context, stack, options, stack[4].val, stack[10].val, undefined);
	}),
	new Production("S", ["if", "(", "EXPR", ")", "then", "SLIST", "else", "SLIST"], function (context, stack, options) {
		ifElseReduction(context, stack, options, stack[4].val, stack[10].val, stack[14].val);
	}),
	new Production("S", ["id", "=", "EXPR", ";"], function (context, stack, options) {
		var RHExpression = stack[4].val;
		context.append(RHExpression);
		var id = Context.nextId();
		context.appendCode([id, "variable", stack[0].val]);
		context.appendCode([id, "assign", RHExpression.lastResult()]);
	}),
	new Production("S", ["while", "(", "EXPR", ")", "SLIST"], function(context, stack, options){
		var topLabel = Context.nextLabel();
		var exitLabel = Context.nextLabel();
		var condPart = stack[4].val;
		context.appendCode([topLabel, "label"]);
		context.append(condPart);
		context.appendCode([exitLabel, "goto_if_false", condPart.lastResult()]);
		context.append(stack[8].val);
		context.appendCode([topLabel, "goto"]);
		context.appendCode([exitLabel, "label"]);
	}),
	new Production("S", ["do", "SLIST", "while", "(", "EXPR", ")", ";"], function(context, stack, options){
		var topLabel = Context.nextLabel();
		var condPart = stack[8].val;
		context.appendCode([topLabel, "label"]);
		context.append(stack[2].val);
		context.append(condPart);
		context.appendCode([topLabel, "goto_if_true", condPart.lastResult()]);
	}),
	new Production("S", ["FUNCTION_CALL", ";"], Context.straightCopy),
	new Production("EXPR", ["OR"], Context.straightCopy),
	new Production("OR", ["OR", "||", "AND"], function(context, stack, options) {
		binop(context, stack, options, "logical_or");
	}),
	new Production("OR", ["AND"], Context.straightCopy),
	new Production("AND", ["AND", "&&", "NOT"], function(context, stack, options) {
		binop(context, stack, options, "logical_and");
	}),
	new Production("AND", ["NOT"], Context.straightCopy),
	new Production("NOT", ["!", "NOT"], function(context, stack, options){
		context.append(stack[2].val);
		context.appendCode([Context.nextId(), "logical_not", stack[2].val.lastResult()]);
	}),
	new Production("NOT", ["E"], Context.straightCopy),
	new Production("E", ["E", "+", "T"], function (context, stack, options) {
		binop(context, stack, options, "add");
	}),
	new Production("E", ["E", "-", "T"], function (context, stack, options) {
		binop(context, stack, options, "subtract");
	}),
	new Production("E", ["T"], Context.straightCopy),
	new Production("T", ["T", "*", "F"], function (context, stack, options) {
		binop(context, stack, options, "mult");
	}),
	new Production("T", ["T", "/", "F"], function (context, stack, options) {
		binop(context, stack, options, "div");
	}),
	new Production("T", ["F"], Context.straightCopy),
	new Production("F", ["id"], function (context, stack, options) {
		context.appendCode([Context.nextId(), "variable", stack[0].val]);
	}),
	new Production("F", ["integer"], function (context, stack, options) {
		context.appendCode([Context.nextId(), "integer_const", stack[0].val]);
	}),
	new Production("F", ["float"], function (context, stack, options) {
		context.appendCode([Context.nextId(), "float_const", stack[0].val]);
	}),
	new Production("F", ["(", "EXPR", ")"], Context.straightCopy),
	new Production("F", ["FUNCTION_CALL"], Context.straightCopy),
	new Production("FUNCTION_CALL", ["id", "(", "OPTIONAL_ARGS", ")"], function(context, stack, options){
		context.append(stack[4].val);
		context.appendCode([Context.nextId(), "call", stack[0].val]);
	}),
	new Production("OPTIONAL_ARGS", ["ARGS"], Context.straightCopy),
	new Production("OPTIONAL_ARGS", [""]),
	new Production("ARGS", ["EXPR"], function(context, stack, options){
		context.append(stack[0].val);
		context.appendCode([stack[0].val.lastResult(), "push_arg"]);
	}),
	new Production("ARGS", ["ARGS", ",", "EXPR"], function(context, stack, options){
		context.append(stack[0].val);
		context.append(stack[4].val);
		context.appendCode([stack[4].val.lastResult(), "push_arg"]);
	})
];
var inputStream = new Lexer().lex(
	"func zoot(a, b, c) {" +
	"	if(a+b/c) then q1 = x*12.34+z;" +
	"	else {" +
	"		q1 = x*(33+z); q2 = q2 + q1;" +
	"	}" +
	"	xx = 23.5;" +
	"   while(xx+1) {" +
	"		xx = xx - 1;" +
	"		n = a(1/2, 3*4);" +
	"		zoot(3+2);" +
	"	}" +
	"	if(d && c||e) then while(e) a(1);" +
	"}"
);

var logger = new StringLogger();

var lalr1 = new LALR1().build(prods);

var reductions = new Reductions(logger);
var parser = new LALR1Parser(logger);
var options = {showStack: 0, showTable: 0, showProductions: 1, pTerse: 0, rTerse: 0, noParse: 0, showItemsets: 0};
var result = parser.parse(lalr1, inputStream, reductions, options);
console.log("----");
console.log(logger.out());
console.log(result);