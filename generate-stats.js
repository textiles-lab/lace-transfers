
function getOffset(from_needle, to_needle) {
	let f = from_needle.match(/^([fb]s?)(-?\d+)$/);
	console.assert(f);
	let t = to_needle.match(/^([fb]s?)(-?\d+)$/);
	console.assert(t);

	off = (f[1] === 'f' || f[1] === 'fs') ? parseInt(f[2]) - parseInt(t[2]) : parseInt(t[2]) - parseInt(f[2]);

	return off;
}

//an absolute lower bound on the number of transfer passes
//known because different racking values require different passes
//attempts to reduce passes by leaving zero stitches on the front bed
//cannot do so if a different stitch wants to stack on front of zero offset stitch
//no savings happen if there are both positive and negative offsets
function computeLowerBound(offsets, firsts) {
	let o = new Set();
	let hasPos = false;
	let hasNeg = false;
	for (let i = 0; i<offsets.length; i++){
		if(offsets[i]!=0){
			if (offsets[i]>0) {
				hasPos = true;
			}
			else {
				hasNeg = true;
			}
			o.add(offsets[i]);
			/*if (firsts[i]) {
				let stack_offsets = new Set();
				let j = i-1;
				let k = i+1;
				while (j > 0 && offsets[j] > offsets[i]){
					stack_offsets.add(offsets[j]);
					j--;
				}
				while(k<offsets.length && offsets[k] < offsets[i]) {
					stack_offsets.add(offsets[k]);
					k++;
				}
				if (stack_offsets.has(0)) {
					o.add(0);
				}
			}*/
		}
	}
	/*if (hasPos && hasNeg) {
		o.add(0);
	}*/
	return (o.size==0) ? 0 : o.size+1//one extra for initial transfer to the back bed;
}

function computeDecreaseDistrib(offsets, firsts) {
	let decreases = {'left':0, 'right':0, 'center':0};
	for (let i=0; i<offsets.length; i++) {
		if(firsts[i]){
			let j = i-1;
			let k = i+1;
			if (j>0 && offsets[j] > offsets[i]) {
				if (k<offsets.length && offsets[i] > offsets[k]) {
					decreases['center']++;
				}
				else {
					decreases['right']++;
				}
			}
			else {
				decreases['left']++;
			}
		}
	}
}

class Stitch{
	constructor(i) {
		this.xfers = 0;
		this.id = i;
	}

	transfer() {
		this.xfers += 1;
	}
}

if (require.main === module) {
	console.log("processing transfer results");

	const fs = require('fs');
	const path = require('path');
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
		
		let all_result = [];

		files.forEach(function(filename){
			try {
				var file = fs.readFileSync(filename, 'utf8');
				//data = JSON.parse(fs.readFileSync(filename));
			} catch (e) {
				console.log(e);
				file = null;
			}
			if (file !== null) {
				console.log("time to process");
				var lines = file.split('\n');


				var comments = []; 
				var data = null;//gonna cheat and assume json is one comment for now
				var xfers = [];

				for (let i = 0; i < lines.length; ++i) {
					if (lines[i].indexOf(';') >= 0) {
						let c = lines[i].substr(lines[i].indexOf(';')+1, lines[i].length);
						comments.push(c);
						try {
							data = JSON.parse(c);
						} catch(e) {
							console.log(e);
							data = null;
						}
					}
					else {
						let tokens = lines[i].split(/[ ]+/);
						op = tokens.shift();
						if (op === 'xfer') {
							xfers.push(tokens);
						}
					}
				}

				
				if (data !== null) {
					//console.log(comments);
					//console.log(xfers);

					var needle_count = data.offsets.length;
					var operation_count = xfers.length;
					var stacked_transfer_count = 0;
					var passes = 1;
					let stat = {};

					//simulate transfers
					let needles = {};
					for (let i = 0; i < needle_count; ++i) {
						needles['f' + i] = [new Stitch(i)];
					}

					if( operation_count ){
					let bedOffset = getOffset(xfers[0][0], xfers[0][1]); //just assume we start at 0?
					let previousBed = xfers[0][0].match(/^([fb]s?)(-?\d+)$/)[1];


					for (let i = 0; i < xfers.length; ++i) {
						let from = needles[xfers[i][0]];
						if (!(xfers[i][1] in needles)) needles[xfers[i][1]] = [];
						let to = needles[xfers[i][1]];

						if (from.length > 1) {
							stacked_transfer_count++;
						}

						while (from.length) {
							let s = from.pop();
							s.transfer();
							to.push(s);
							//console.log('xfer ' + s.id);
						}

						let needle_offset = getOffset(xfers[i][0], xfers[i][1]);
						let currentBed = xfers[i][0].match(/^([fb]s?)(-?\d+)$/)[1];
						if (needle_offset != bedOffset || previousBed != currentBed) {
							//console.log(previousBed + ' to ' + currentBed);
							bedOffset = needle_offset;
							previousBed = currentBed;
							passes++; //TODO: does the racking action itself need another pass?
						}
					}
					}

					console.log("passes: " + passes);
					console.log("stacked transfers: " + stacked_transfer_count);

					stat.name = path.basename(filename, '.xout');
					stat.passes = passes;
					stat.stack_transfers = stacked_transfer_count;
					stat.needle_count = needle_count;
					stat.operation_count = operation_count;
					stat.empty_xfers = data.xferredEmpty;
					stat.trimmed_xfers = operation_count-data.xferredEmpty;
					stat.xfer_per_needle = stat.trimmed_xfers/stat.needle_count;

					let total_stacks = 0;
					let correct_stacks = 0;

					for (let i = 0; i < data.firsts.length; i++) {
						if (needles['f'+i].length > 1) {
							total_stacks++;
							if (data.firsts[needles['f'+i][0].id]) {
								correct_stacks++;
							}
						}	
					}

					stat.total_stacks = total_stacks;
					stat.correct_stacks = correct_stacks;
					stat.stack_fraction = correct_stacks/total_stacks;
					stat.lower_bound = computeLowerBound(data.offsets, data.firsts);
					stat.worse_than = passes-stat.lower_bound;

					all_result.push(stat);
				}	
			}
		});
		//write a csv
		let csv_content = "";
		let line_sep = ',';
		let col_sep = '\n';

		let keys = Object.keys(all_result[0]);
		csv_content += keys.join(line_sep)+col_sep;

		all_result.forEach(function(result){
			let line = result[keys[0]];
			for (let i = 1; i < keys.length; i++) {
				line += line_sep + result[keys[i]];
			}
			line += col_sep;
			csv_content += line;
		});
		fs.writeFileSync(path.basename(name, '.xout')+'.csv', csv_content);


	}

}
