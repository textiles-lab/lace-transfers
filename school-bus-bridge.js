function multi_pass_transfers(offsets, firsts, minRacking, maxRacking, xfer) {

/*	var tempGoal = fill_all_valleys(offsets, firsts);
	print_goal(tempGoal, firsts);

*/	
	var currentOffset = 0;
	let needle_pos = [];
	for (let i = 0; i < offsets.length; ++i) {
		needle_pos[i] = i;
	}


	for (let i = 0; i < offsets.length; ++i) {
		xfer('f', i, 'b', i-currentOffset);
	}
/*	currentOffset = minRacking; //TODO: check whether starting with maxRacking would be better 
	while (currentOffset < maxRacking) {
		++currentOffset
		for (let i = 0; i < offsets.length; ++i) {
			if (tempGoal[i]==currentOffset) {
				xfer('b', i, 'f', i+currentOffset);
				needle_pos[i] = i+currentOffset;
			}
		}
	}*/

	function min_to_max_pass(goal, startOffset) {
		//let tempGoal = fill_all_valleys(goal, firsts);
		print_goal(goal, firsts);
		while (currentOffset < maxRacking) {
			++currentOffset;
			for (let i = 0; i < goal.length; ++i) {
				if (goal[i] == currentOffset-startOffset) {
					xfer('b', needle_pos[i], 'f', needle_pos[i]+currentOffset);
					needle_pos[i] = needle_pos[i]+currentOffset;
				}
			}
		}

		//return Array.from(goal, (x, i) => x - tempGoal[i]);
	}

	function max_to_min_pass(goal, startOffset) {
		//let tempGoal = flatten_all_hills(goal, firsts);
		//console.log("flattened hill goal is: ");
		print_goal(goal, firsts);
		while (currentOffset >= minRacking) {
			console.log(currentOffset - startOffset);
			currentOffset--;
			for (let i = 0; i < goal.length; ++i) {
				//started at max racking, so adjust offsets for that
				if (goal[i] == currentOffset - startOffset) {
					//transfer
					xfer('b', needle_pos[i], 'f', needle_pos[i]+currentOffset);
					needle_pos[i] = needle_pos[i] + currentOffset;
				}
			}
		}

	}

	var increasing = true;
	currentOffset = increasing ? (minRacking-1) : (maxRacking+1); //for the very first pass, everything has to go to the back bed
	var tempGoal = increasing ? fill_all_valleys(offsets, firsts) : flatten_all_hills(offsets, firsts);
	increasing ? min_to_max_pass(tempGoal, 0, minRacking) : max_to_min_pass(tempGoal, 0, maxRacking);
	var middleGoal = Array.from(offsets, (x,i) => x - tempGoal[i]);
	print_goal(middleGoal, firsts);
	while (!is_done(middleGoal)) {
		increasing = !increasing;
		tempGoal = increasing ? fill_all_valleys(middleGoal, firsts) : flatten_all_hills(middleGoal, firsts);
		for (let i=0; i < offsets.length; ++i) {
			if (tempGoal[i] != 0) {
				xfer('f', needle_pos[i], 'b', needle_pos[i]-currentOffset);
				needle_pos[i] = needle_pos[i] - currentOffset;
			}
		}
		//increasing ? currentOffset++ : currentOffset--;
		increasing ? min_to_max_pass(tempGoal, minRacking) : max_to_min_pass(tempGoal, maxRacking);
		middleGoal = Array.from(middleGoal, (x,i) => x - tempGoal[i]);
		print_goal(middleGoal, firsts);
	}




}

function fill_all_valleys(offsets, firsts) {
	var filledOffsets = [];
	var index = 0;

	while (index < offsets.length) {
		filledOffsets[index] = offsets[index];
		if (firsts[index]) {
			//found a front stitch, do fill checks
			let floor = offsets[index];
			++index;
			while (index < offsets.length && offsets[index] < floor) {
				filledOffsets[index] = floor;
				++index;
			}
		}
		else {
			//no need to fill, just continue
			++index;
		}
	}

	return filledOffsets;
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
		}
		else if (offsets[index] < maxHill) {
			//no need to flatten, reset and check for decrease region
			maxHill = Infinity;
			newOffsets[index] = offsets[index];

			if (offsets[index] > offsets[index+1]) {
				//in decreasing section
				maxHill = offsets[index];
				if (firsts[index]) {
					//fill to make center into right leaning
					let minFloor = offsets[index];
					let start = index+1;
					while (start < offsets.length && newOffsets[start] < minFloor) {
						newOffsets[start] = minFloor;
						++start;
					}
					//check to see if this was actually left leaning
					if (offsets[index] >= offsets[index-1]) {
						//if so, no need to flatten hills
						maxHill = Infinity;
					}
				}
			}

		}
		else {
			newOffsets[index] = offsets[index];
		}
		--index;
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
		}
		else if (offsets[index] > minFloor) {
			minFloor = -Infinity;
			newOffsets[index] = offsets[index]
			if (offsets[index] < offsets[index-1]) {
				//in decreasing section
				minFloor = offsets[index];
				if (firsts[index]) {
					//fill to make left leaning
					let maxHill = offsets[index]
					let start = index-1;
					while (start => 0 && newOffsets[start] > maxHill) {
						newOffsets[start] = maxHill;
						--start;
					}
					//check to see if this was a right leaning
					if (offsets[index+1] >= offsets[index]) {
						minFloor = -Infinity;
					}
				}
			}

		}
		else {
			newOffsets[index] = offsets[index];
		}
		index++;
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
	console.log(" first:" + infoF);
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
	console.log("Doing some test general transfers.");
	function test(offsets, firsts, limit) {
		let needles = {};
		for (let i = 0; i < offsets.length; ++i) {
			needles['f' + i] = [i];
		}

		function dumpNeedles() {
			let minNeedle = 0;
			let maxNeedle = offsets.length-1;
			for (let n in needles) {
				let m = n.match(/^[fb](-?\d+)$/);
				console.assert(m);
				let val = parseInt(m[1]);
				minNeedle = Math.min(minNeedle, val);
				maxNeedle = Math.max(maxNeedle, val);
			}

			let layers = [];
			for (let n = minNeedle; n <= maxNeedle; ++n) {
				if (('b' + n) in needles) {
					needles['b' + n].forEach(function(i, d){
						while (d >= layers.length) layers.push("");
						while (layers[d].length < n * 3) layers[d] += "   ";
						layers[d] += " ";
						if (i < 10) layers[d] += " " + i;
						else layers[d] += i;
					});
				}
			}
			for (let l = layers.length - 1; l >= 0; --l) {
				console.log(" back:" + layers[l]);
			}
			layers = [];
			for (let n = minNeedle; n <= maxNeedle; ++n) {
				if (('f' + n) in needles) {
					needles['f' + n].forEach(function(i, d){
						while (d >= layers.length) layers.push("");
						while (layers[d].length < n * 3) layers[d] += "   ";
						layers[d] += " ";
						if (i < 10) layers[d] += " " + i;
						else layers[d] += i;
					});
				}
			}
			for (let l = layers.length - 1; l >= 0; --l) {
				console.log("front:" + layers[l]);
			}

			let infoI = "";
			for (let n = minNeedle; n <= maxNeedle; ++n) {
				if      (n < -10) infoI += n.toString();
				else if (n <   0) infoI += " " + n.toString();
				else if (n === 0) infoI += "  0";
				else if (n <  10) infoI += "  " + n.toString();
				else              infoI += " " + n.toString();
			}
			console.log("index:" + infoI);
		}
		let log = [];

		function xfer(fromBed, fromIndex, toBed, toIndex) {
			let cmd = "xfer " + fromBed + fromIndex + " " + toBed + toIndex;
			//console.log(cmd);
			log.push(cmd);

			console.assert((fromBed === 'f' && toBed === 'b') || (fromBed === 'b' && toBed === 'f'), "must xfer f <=> b");

			//check for valid racking:
			let at = [];
			for (let i = 0; i < offsets.length; ++i) {
				at.push(null);
			}
			for (var n in needles) {
				let m = n.match(/^([fb])(-?\d+)$/);
				console.assert(m);
				needles[n].forEach(function(s){
					console.assert(at[s] === null, "each stitch can only be in one place");
					at[s] = {bed:m[1], needle:parseInt(m[2])};
				});
			}

			let minRacking = -Infinity;
			let maxRacking = Infinity;
			for (let i = 1; i < offsets.length; ++i) {
				if (at[i-1].bed === at[i].bed) continue;
				let slack = Math.max(1, Math.abs( i+offsets[i] - (i-1+offsets[i-1]) ));
				let back  = (at[i].bed === 'b' ? at[i].needle : at[i-1].needle);
				let front = (at[i].bed === 'b' ? at[i-1].needle : at[i].needle);

				//-slack <= back + racking - front <= slack
				minRacking = Math.max(minRacking, -slack - back + front);
				maxRacking = Math.min(maxRacking,  slack - back + front);
			}
			console.assert(minRacking <= maxRacking, "there is a valid racking for this stitch configuration");
			let racking = (fromBed === 'f' ? fromIndex - toIndex : toIndex - fromIndex);
			console.assert(minRacking <= racking && racking <= maxRacking, "required racking " + racking + " is outside [" + minRacking + ", " + maxRacking + "] valid range. (" + cmd + ")");



			var from = needles[fromBed + fromIndex];
			if (!((toBed + toIndex) in needles)) needles[toBed + toIndex] = [];
			var to = needles[toBed + toIndex];

			console.assert(from.length !== 0, "no reason to xfer empty needle");
			//console.assert(from.length === 1, "shouldn't ever xfer stack");

			while (from.length) to.push(from.pop());

			//dumpNeedles(); //DEBUG
		}

		print_goal(offsets, firsts);

		let minRacking = -1*limit;
		let maxRacking = limit;

		multi_pass_transfers(offsets, firsts, minRacking, maxRacking, xfer);

		dumpNeedles();

		for (let i = 0; i < offsets.length; ++i) {
			var n = needles['f' + (i + offsets[i])];
			console.assert(n.indexOf(i) !== -1, "needle got to destination");
			if (firsts[i]) {
				console.assert(n.indexOf(i) === 0, "first got to destination first");
			}
		}

		console.log(log.length + " transfers, avg " + (log.length/offsets.length) + " per needle.");

		return log;
	}

	test([+1,+1,+2,+2,+3,+3,+2,+1],
	     [ 0, 0, 0, 0, 0, 1, 0, 0], 4);

	const fs = require('fs');
	for (let i = 2; i < process.argv.length; ++i) {
		let name = process.argv[i];
		if (name.endsWith("/")) name = name.substr(0,name.length-1);
		const stats = fs.lstatSync(name);
		let files;
		if (stats.isDirectory()) {
			files = [];
			fs.readdirSync(name).forEach(function(filename){
				files.push(name + "/" + filename);
			});
		} else {
			files = [name];
		}
		files.forEach(function(filename){
			console.log(filename + " ...");
			let data = null;
			try {
				data = JSON.parse(fs.readFileSync(filename));
			} catch (e) {
				console.log(e);
				data = null;
			}
			if (data !== null) {
				//Check inputs:
				let minRacking = -1*data.transferMax;
				let maxRacking = data.transferMax;

				if (data.offsets.length != data.firsts.length) {
					console.log("Offsets and firsts should be the same length");
					return;
				}

				if (minRacking >= maxRacking) {
					console.log("min racking must be strictly less than max racking");
					return;
				}
				
				let validMin = minRacking;
				for (let i = 0; i < data.offsets.length; ++i) {
					if (data.offsets[i] < validMin) {
						console.log("offset falls below valid min value" );
						return;
					}
					validMin = Math.max(data.offsets[i]-1, minRacking);
					if (data.offsets[i] > maxRacking) {
						console.log("offset is above maxRacking" );
						return;
					}
				}

				test(data.offsets, data.firsts, data.transferMax);
			}
		});
	}

}
