"use strict";

var Token = require("./token");

var Lexer = module.exports = function Lexer() {

};

Lexer.prototype.lex = function (input, options) {
	options = options || {};
	var tokens = [];
	var patterns = [
		['white', /^\s+/],
		[undefined, /^(if|then|for|while|else|func|&&|\|\|)/],
		['id', /^[A-Za-z]+\w*/],
		['float', /^\d+\.\d*/],
		['float', /^\d*\.\d+/],
		['integer', /^\d+/],
		[undefined, /^[!-~]/]
	];

	var quiet = false;
	while (input.length > 0) {
		var found = false;
		for (var i = 0; i < patterns.length; i++) {
			var res = patterns[i][1].exec(input);
			if (res) {
				var value = res[0];
				var className = patterns[i][0] || value;	// If the class is undefined, use the value.
				var token = new Token(className, value);
				if (options.keepWhite || token.parserSymb !== 'white') tokens.push(token);
				input = input.slice(value.length);
				quiet = false;
				found = true;
				break;
			}
		}
		if (!found) {
			if (!quiet) {
				quiet = true;
				console.log("invalid input: '" + input + "'");
			}
			input = input.slice(1);
		}
	}
	return tokens;
};
//
//var lexer = new Lexer();
//var tokens = lexer.lex("now  \nis 123 234. 567.34 .789 the time (*&^ for...[]/$", {keepWhite:0});
//tokens.forEach(function (token) {
//	console.log(token);
//});