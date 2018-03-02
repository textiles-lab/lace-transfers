function multi_pass_transfers(offsets, firsts, minRacking, maxRacking, xferToBack, xferToFront) {
	//Check inputs:
	if (offsets.length != firsts.length) {
		throw "Offsets and firsts should be the same length";
	}

	if (minRacking >= maxRacking) {
		throw "min racking must be strictly less than max racking" ;
	}

	var validMin = minRacking;
	for (let i = 0; i < offsets.length; ++i) {
		if (offsets[i] < validMin) {
			throw "offset falls below valid min value" ;
		}
		validMin = Math.max(offsets[i]-1, minRacking);
		if (offsets[i] > maxRacking) {
			throw "offset is above maxRacking";
		}
	}

	var tempGoal = fill_all_valleys(offsets, firsts);

	
	var currentOffset = 0;
	currentOffset = minRacking; //TODO: check whether starting with maxRacking would be better 
}

function fill_all_valleys(offsets, firsts) {
	var filledOffsets = [];
	var index = 0;

	while (index < offsets.length) {
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
			//no need to fill, just copy
			filledOffsets[index] = offsets[index];
			++index;
		}
	}

	return filledOffsets;
}

function flatten_all_hills(offsets, firsts) {
	flattenedOffsets = [];

	return flattenedOffsets;
}


//-------------------------------------------------
//testing code, ripped from lace-transfers:
//
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

if (require.main === module) {
	console.log("Doing some test lace transfers.");
	function test(offsets, firsts) {
		let frontStacks = [];
		let backStacks = [];
		let moved = [];
		for (let i = 0; i < offsets.length; ++i) {
			frontStacks.push([i]);
			backStacks.push([]);
			moved.push(false);
		}
		let log = [];
		function xferToBack(i, ofs) {
			var stack = frontStacks[i];
			console.assert(stack.length === 1 && stack[0] === i, "xferToBack should be called on a lone loop on the front");
			console.assert(backStacks[i].length === 0, "xferToBack should have empty dest");
			backStacks[i-ofs] = stack;
			frontStacks[i] = [];
			moved[i] = true;

			let cmd = "xfer " + 'f' + i + " " + 'b' + (i-ofs) + " ; ofs: " + ofs;
			log.push(cmd);
			console.log(cmd);
		}
		function xferToFront(i, ofs) {
			//console.assert(offsets[i] === ofs, "lace_transfers must pass offsets[i]");

			var stack = backStacks[i];
			console.assert(stack.length === 1 && stack[0] === i, "xferToFront should be called on a lone loop on the back");
			console.assert(!(firsts[i] && frontStacks[i+ofs].length > 0), "xferToFront shouldn't put first stitch anywhere but first");

			backStacks[i] = [];
			frontStacks[i+ofs].push(i);

			let cmd = "xfer " + 'b' + i + " " + 'f' + (i+ofs) + " ; ofs: " + ofs;
			log.push(cmd);
			console.log(cmd);
		}

		print_goal(offsets, firsts);

		//lace_transfers(offsets, firsts, xferToBack, xferToFront);
		multi_pass_transfers(offsets, firsts, -8, 8, xferToBack, xferToFront);
		
		return;
		for (let i = 0; i < offsets.length; ++i) {
			console.assert(backStacks[i].length === 0, "back needles left empty");
			console.assert(moved[i] || offsets[i] === 0, "moved needles that needed it");
		}

		let layers = [];
		for (let n = 0; n < offsets.length; ++n) {
			frontStacks[n].forEach(function(i, d){
				while (d >= layers.length) layers.push("");
				while (layers[d].length < n * 3) layers[d] += "   ";
				layers[d] += " ";
				if (i < 10) layers[d] += " " + i;
				else layers[d] += i;
			});
		}
		for (let l = layers.length - 1; l >= 0; --l) {
			console.log("stitches:" + layers[l]);
		}
		console.log("   index:" + infoI);
		console.log(log.length + " transfers, avg " + (log.length/offsets.length) + " per needle.");

	}

	test([+1,+1,+2,+2,+3,+3,+2,+1],
	     [ 0, 0, 0, 0, 0, 1, 0, 0], 2);

	/*test([ 0, 0,+1, 0, 0,+1,-1, 0, 0],
	     [ 0, 0, 0, 0, 0, 0, 0, 0, 0], 2);
	     */

}
