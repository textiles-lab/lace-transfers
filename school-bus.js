#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

//basic schoolbus algorithm
function school_bus_basic(offsets, minRacking, maxRacking, xfer){
	var stock = true;
	for (let i = 0; i < offsets.length; i++) {
		if (offsets[i]!=0) {
			stock = false;
		}
	}
	if (stock) {
		return;
	}

	for (let i = 0; i < offsets.length; i++) {
		xfer('f', i, 'b', i);
	}

	var currentOffset = minRacking;
	while (currentOffset <= maxRacking) {
		for (let i = 0; i < offsets.length; i++) {
			if (offsets[i] == currentOffset) {
				xfer('b', i, 'f', i+currentOffset);
			}
		}
		currentOffset++;
	}
}

module.exports.school_bus_basic = school_bus_basic;

if (require.main === module) {
	console.log("Doing some test transfers.");

	const testDriver = require('./test-driver.js');

	//adaptor to fit into testDriver
	function _school_bus_basic(offsets, firsts, orders, limit, xfer) {
		school_bus_basic(offsets, -limit, limit, xfer);
	}

	if (process.argv.length > 2) {
		testDriver.runTests(_school_bus_basic, {
			skipCables:true,
			skipLong:true,
			//ignoreStacks:true,
			//ignoreEmpty:true,
			ignoreFirsts:true,
			outDir:'results/schoolbus'
		});
		return;
	}

	
}
