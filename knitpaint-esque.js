#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

//sort of what knitpaint does, but while respecting slack
//doesn't respect stacking, but does minimize pass count and total transfers
function knitpaint_esque(offsets, minRacking, maxRacking, xfer){
	for (let i = 0; i < offsets.length; i++) {
		if (offsets[i] > 0) {
			xfer('f', i, 'b', i);
		}
	}

	var currentOffset = 1;
	while (currentOffset <= maxRacking) {
		for (let i = 0; i < offsets.length; i++) {
			if (offsets[i] == currentOffset) {
				xfer('b', i, 'f', i+currentOffset);
			}
		}
		currentOffset++;
	}

	for (let i = 0; i < offsets.length; i++) {
		if (offsets[i] < 0) {
			xfer('f', i, 'b', i);
		}
	}

	currentOffset = -1;
	while (currentOffset >= minRacking) {
		for (let i = 0; i < offsets.length; i++) {
			if (offsets[i] == currentOffset) {
				xfer('b', i, 'f', i+currentOffset);
			}
		}
		currentOffset--;
	}

}

if (require.main === module) {
	console.log("Doing some test transfers.");

	const testDriver = require('./test-driver.js');

	//adaptor to fit into testDriver
	function _knitpaint_esque(offsets, firsts, orders, limit, xfer) {
		knitpaint_esque(offsets, -limit, limit, xfer);
	}

	if (process.argv.length > 2) {
		testDriver.runTests(_knitpaint_esque, {
			skipCables:true,
			skipLong:true,
			//ignoreStacks:true,
			//ignoreEmpty:true,
			ignoreFirsts:true,
			outDir:'results/knitpaint'
		});
		return;
	}

	
}

