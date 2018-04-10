#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

function multi_pass_transfers(offsets, firsts, minRacking, maxRacking, xfer) {

	var currentOffset = 0;
	let needle_pos = [];
	let on_front = [];
	for (let i = 0; i < offsets.length; ++i) {
		needle_pos[i] = i;
		on_front[i] = true;
	}


	
	function min_to_max_pass(goal, startOffset) {
		print_goal(goal, firsts);
		while (currentOffset < maxRacking) {
			++currentOffset;
			console.log(currentOffset - startOffset);
			for (let i = 0; i < goal.length; ++i) {
				if (goal[i] == currentOffset-startOffset && !on_front[i]) {
					xfer('b', needle_pos[i], 'f', needle_pos[i]+currentOffset);
					on_front[i] = true;
					needle_pos[i] = needle_pos[i]+currentOffset;
				}
			}
		}
	}

	function max_to_min_pass(goal, startOffset) {
		print_goal(goal, firsts);
		while (currentOffset >= minRacking) {
			currentOffset--;
			console.log(currentOffset - startOffset);
			for (let i = 0; i < goal.length; ++i) {
				if (goal[i] == currentOffset - startOffset  && !on_front[i]) {
					xfer('b', needle_pos[i], 'f', needle_pos[i]+currentOffset);
					on_front[i] = true;
					needle_pos[i] = needle_pos[i] + currentOffset;
				}
			}
		}

	}

	var increasing = true;
	
	var tempGoal = increasing ? make_right_leaning_decreases(offsets, firsts) : make_left_leaning_decreases(offsets, firsts);
	console.log("result of processing");
	print_goal(tempGoal, firsts);
	if (!is_done(tempGoal)){
		for (let i = 0; i < offsets.length; ++i) {
			xfer('f', i, 'b', i-currentOffset);
			on_front[i] = false;
		}
		currentOffset = increasing ? (minRacking-1) : (maxRacking+1); //for the very first pass, everything has to go to the back bed
		increasing ? min_to_max_pass(tempGoal, 0, minRacking) : max_to_min_pass(tempGoal, 0, maxRacking);
	}
	var middleGoal = Array.from(offsets, (x,i) => x - tempGoal[i]);
	console.log("result after running processing");
	print_goal(middleGoal, firsts);
	while (!is_done(middleGoal)) {
		increasing = !increasing;
		tempGoal = increasing ? make_right_leaning_decreases(middleGoal, firsts) : make_left_leaning_decreases(middleGoal, firsts);
		console.log("result of processing");
		print_goal(tempGoal, firsts);
		
		if (!is_done(tempGoal)){
			currentOffset = 0;
			for (let i=0; i < offsets.length; ++i) {
				//if (tempGoal[i] != 0) {
					xfer('f', needle_pos[i], 'b', needle_pos[i]-currentOffset);
					on_front[i] = false;
					needle_pos[i] = needle_pos[i] - currentOffset;
				//}
			}
			currentOffset = increasing ? (minRacking-1) : (maxRacking+1);
			increasing ? min_to_max_pass(tempGoal, 0) : max_to_min_pass(tempGoal, 0);//assume start from zero, like we always start
		}
		middleGoal = Array.from(middleGoal, (x,i) => x - tempGoal[i]);
		console.log("result after running processing");
		print_goal(middleGoal, firsts);
	}




}

function make_right_leaning_decreases(offsets, firsts) {
	var newOffsets = [];
	var index = offsets.length - 1;
	var maxHill = Infinity;

	//set the initial stitch to make later loops easier to write
	newOffsets[index] = offsets[index];
	--index;

	while (index >= 0) {
		if (offsets[index] > maxHill) {
			//all regions larger than maxHill must be flattened
			newOffsets[index] = maxHill;
			//console.log("index " + index + " is flattened");
			--index;
		}
		else if (offsets[index] < maxHill) {
			//no need to flatten, reset and check for decrease region
			maxHill = Infinity;
			newOffsets[index] = offsets[index];
			//console.log("setting stitch " + index);

			if (offsets[index+1] >= offsets[index]) {
				index--;
				continue;
			}

			while (offsets[index] > offsets[index+1] && index >= 0) {
				//in decreasing section
				//console.log("found decrease at " + index);
				maxHill = offsets[index];
				if (firsts[index]) {
					//fill to make center into right leaning
					//console.log("decrease center is at " + index);
					let minFloor = offsets[index];
					let start = index+1;
					while (start < offsets.length && newOffsets[start] < minFloor) {
						//console.log("filled " + start);
						newOffsets[start] = minFloor;
						++start;
					}
					//check to see if this was actually left leaning
					if (offsets[index] >= offsets[index-1]) {
						//if so, no need to flatten hills
						//console.log("stop filling at " + index);
						maxHill = Infinity;
					}
				}
				--index;
				newOffsets[index] = offsets[index];
			}

		}
		else {
			//console.log("index " + index + " is fine");
			newOffsets[index] = offsets[index];
			--index;
		}
	}

	return newOffsets;
}

function make_left_leaning_decreases(offsets, firsts) {
	var newOffsets = []
	var index = 0;
	var minFloor = -Infinity;

	//explicitly setting initial stitch
	newOffsets[index] = offsets[index];
	++index;

	while (index < offsets.length) {
		if (offsets[index] < minFloor) {
			newOffsets[index] = minFloor;
			++index;
		}
		else if (offsets[index] > minFloor) {
			minFloor = -Infinity;
			newOffsets[index] = offsets[index]
			if (offsets[index] >= offsets[index-1]) {
				index++;
				continue;
			}
			while (offsets[index] < offsets[index-1] && index < offsets.length) {
				//in decreasing section
				minFloor = offsets[index];
				if (firsts[index]) {
					//fill to make left leaning
					let maxHill = offsets[index]
					let start = index-1;
					while (start >= 0 && newOffsets[start] > maxHill) {
						newOffsets[start] = maxHill;
						--start;
					}
					//check to see if this was a right leaning
					if (offsets[index+1] >= offsets[index]) {
						minFloor = -Infinity;
					}
				}
				index++;
				newOffsets[index] = offsets[index];
			}

		}
		else {
			newOffsets[index] = offsets[index];
			index++;
		}
	}

	return newOffsets;
}

function flatten_all_hills(offsets, firsts) {
	var flattenedOffsets = [];
	var index = offsets.length - 1;
	var maxHill = Infinity;
	//just set the initial stitch to make later loops less annoying to write
	flattenedOffsets[index] = offsets[index]
	--index;

	while (index >= 0) {
		if (offsets[index] > maxHill) {
			flattenedOffsets[index] = maxHill;
			continue;
		}
		else {
			maxHill = Infinity;
		}
		flattenedOffsets[index] = offsets[index];
		
		while (offsets[index] > offsets[index+1]) { //in decreasing section
			maxHill = offsets[index]
			
			--index;
			flattenedOffsets[index] = offsets[index]
			//if the not bottom-most stitch is starred, we need to fill a valley
			if (firsts[index]) {
				let floor = firsts[index];
				let start = index+1;
				while (start < offsets.length && flattendOffsets[start] < floor) {
					flattenedOffset[start] = floor;
					start++;
				}
			}


		}
/*		if (firsts[index]) {
			let ceiling = offsets[index];
			--index;
			while (index >=0 && offsets[index] > ceiling) {
				flattenedOffsets[index] = ceiling;
				--index;
			}
		}
		else {
			--index;
		}
	}
*/
	}
	return flattenedOffsets;
}

function process_stacks_decreasing(offsets, firsts) {
	//
	var processed_offsets = []
	var index = offsets.length -1;

	//while (index >=0) {

}

function is_done(offsets) {
	for (let i = 0; i < offsets.length; ++i) {
		if (offsets[i]!=0) {
			return false;
		}
	}
	return true;
}

function print_goal(offsets, firsts) {
	let infoI = "";
	let infoO = "";
	let infoF = "";
	for (let i = 0; i < offsets.length; ++i) {
		infoI += " ";
		infoO += " ";
		infoF += " ";
		
		if (i < 10) infoI += " " + i;
		else infoI += i;

		if (offsets[i] < 0) infoO += offsets[i];
		else if (offsets[i] > 0) infoO += "+" + offsets[i];
		else infoO += " 0";

		if (firsts[i]) {
			infoF += " *";
		} else {
			infoF += "  ";
		}
	}
	console.log(" index:" + infoI);
	console.log("offset:" + infoO);
	console.log(" first:" + infoF + "\n");
}
//-------------------------------------------------
//testing code:

function offsetsToString(offsets) {
	let info = "";
	for (let i = 0; i < offsets.length; ++i) {
		if (i !== 0) info += " ";
		if (offsets[i] < 0) info += offsets[i];
		else if (offsets[i] > 0) info += "+" + offsets[i];
		else info += " 0";
	}
	return info;
}

if (require.main === module) {
	console.log("Doing some test transfers.");

	const testDriver = require('./test-driver.js');

	//adaptor function that throws away unused parameters:
	function _multi_pass_transfers(offsets, firsts, orders, limit, xfer) {
		multi_pass_transfers(offsets, firsts, -limit, limit, xfer);
	}

	if (process.argv.length > 2) {
		testDriver.runTests(_multi_pass_transfers, {
			skipCables:true,
			skipLong:true,
			ignoreStacks:true,
			ignoreEmpty:true,
			outDir:'results/multipass'
		});
		return;
	}

	function test(offsets, firsts, limit) {
		let orders = [];
		while (orders.length < offsets.length) orders.push(0);
		testDriver.test(_multi_pass_transfers, offsets, firsts, orders, limit, {ignoreStacks:true});
	}

	test([+1,+1,+2,+2,+3,+3,+2,+1],
	     [ 0, 0, 0, 0, 0, 1, 0, 0], 4);

}
