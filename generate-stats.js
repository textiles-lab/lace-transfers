
function getOffset(from_needle, to_needle) {
	let f = from_needle.match(/^[fb](-?\d+)$/);
	console.assert(f);
	let t = to_needle.match(/^[fb](-?\d+)$/);
	console.assert(t);

	off = (f[0] === 'f' || f[0] === 'fs') ? parseInt(f[1]) - parseInt(t[1]) : parseInt(t[1]) - parseInt(f[1]);

	return off;
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

					//simulate transfers
					let needles = {};
					for (let i = 0; i < needle_count; ++i) {
						needles['f' + i] = [new Stitch(i)];
					}

					let bedOffset = 0; //just assume we start at 0?


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
						if (needle_offset != bedOffset) {
							bedOffset = needle_offset;
							passes++; //TODO: does the racking action itself need another pass?
						}
					}

					console.log("passes: " + passes);
					console.log("stacked transfers: " + stacked_transfer_count);
				}


				
			}
		});

	}

}
