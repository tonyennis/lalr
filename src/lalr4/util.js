"use strict;"

var Util = module.exports = function Util() {
};

Util.isNonterminal = function (s) {
	return /^[A-Z]/.test(s);
};

Util.isTerminal = function (s) {
	return !Util.isNonterminal(s);
};

Util.box = function (label) {
	var s = "",
		i;
	var w = label.length + 4;
	for (i = 0; i < w; i++) s += "*";
	s += "\n";
	s += "* " + label + " *\n";
	for (i = 0; i < w; i++) s += "*";
	s += "\n";
	return s;
};