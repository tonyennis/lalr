var Reductions = require("./reductions"),
	Token = require("./token"),
	TokenStream = require("./TokenStream"),
	builder = require("./lalr1-builder"),
	Production = builder.Production,
	LALR1 = builder.LALR1,
	LALR1Parser = require("./lalr1-parser"),
	StringLogger = require("./string-logger");

var prods = [
	new Production("S", ["yadda"]),
	new Production("S", ["allures"]),
	new Production("S", ["zoot"]),
	new Production("S", ["if", "(", "E", ")", "then", "S"]),
	new Production("S", ["if", "(", "E", ")", "then", "S", "else", "S"]),
	new Production("S", ["id", "=", "E"]),
	new Production("E", ["E", "+", "T"]),
	new Production("E", ["E", "-", "T"]),
	new Production("E", ["T"]),
	new Production("T", ["T", "*", "F"]),
	new Production("T", ["T", "/", "F"]),
	new Production("T", ["F"]),
	new Production("F", ["G", "^", "F"]),
	new Production("F", ["G"]),
	new Production("G", ["id"]),
	new Production("G", ["(", "E", ")"])
];

var logger = new StringLogger();

var lalr1 = new LALR1().build(prods);
//var inputStream = new TokenStream("if (c+d) then if(a*b) then d=e+f*g else yadda else zoot");
var inputStream = new TokenStream("a = b * c ^ d ^ ( e + f )");
var reductions = new Reductions(logger);
var parser = new LALR1Parser(logger);
var options = {showStack: 1, showTable: 0, showProductions: 0, pTerse: 1, rTerse: 1, noParse: 0, showItemsets:0};
var result = parser.parse(lalr1, inputStream, reductions, options);
console.log("----");
console.log(logger.out());
