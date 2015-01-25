"use strict;";

var Token = require("./token");

var TokenStream = module.exports = function (s) {
	var stream = [];
	// split on word boundaries, consuming whitespace on either side.
	s.split(/\s+/).forEach(function (t) {
		// IDs are all single lower case letters
		if (t >= "a" && t <= "z" && t.length===1) stream.push(new Token("id", t));
		else stream.push(new Token(t, t));
	});
	return stream;
};