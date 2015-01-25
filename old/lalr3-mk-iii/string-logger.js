var StringLogger = module.exports = function StringLogger() {
	this.text = "";
};

StringLogger.prototype.log = function (s) {
	this.text += s + "\n";
};

StringLogger.prototype.out = function () {
	return this.text;
};