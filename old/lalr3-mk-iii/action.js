"use strict";

var BaseAction = function BaseAction(type, val) {
	this.type = type;
	this.val = val;
};
BaseAction.prototype.toString = function() {
	return this.type+":"+this.val;
};
BaseAction.prototype.nice = function() {
	return this.type[0].toLowerCase()+this.val;
};

var ShiftAction = function ShiftAction(val) {
	BaseAction.call(this, this.constructor.name, val);
};
ShiftAction.prototype = Object.create(BaseAction.prototype);
ShiftAction.prototype.constructor = ShiftAction;

var GotoAction = function GotoAction(val) {
	BaseAction.call(this,  this.constructor.name, val);
};
GotoAction.prototype = Object.create(BaseAction.prototype);
GotoAction.prototype.constructor = GotoAction;

var ReduceAction = function ReduceAction(val) {
	BaseAction.call(this,  this.constructor.name, val);
};
ReduceAction.prototype = Object.create(BaseAction.prototype);
ReduceAction.prototype.constructor = ReduceAction;

var AcceptAction = function AcceptAction() {
	BaseAction.call(this,  this.constructor.name, undefined);
};
AcceptAction.prototype = Object.create(BaseAction.prototype);
AcceptAction.prototype.constructor = AcceptAction;
AcceptAction.prototype.nice = function() {
	return "a";
};


var InvalidAction = function InvalidAction(info) {
	BaseAction.call(this,  this.constructor.name, info);
};
InvalidAction.prototype = Object.create(BaseAction.prototype);
InvalidAction.prototype.constructor = InvalidAction;
InvalidAction.prototype.nice = function() {
	return "";
};
module.exports.BaseAction = BaseAction;
module.exports.ShiftAction = ShiftAction;
module.exports.GotoAction = GotoAction;
module.exports.ReduceAction = ReduceAction;
module.exports.AcceptAction = AcceptAction;
module.exports.InvalidAction = InvalidAction;

