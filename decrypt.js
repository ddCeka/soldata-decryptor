"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const acorn = require("./acorn");
const LZString = require("./www/js/libs/lz-string.js");

// utilities
function* scandir(dir) {
	for (let filename of fs.readdirSync(dir)) {
		filename = path.join(dir, filename);
		if (fs.statSync(filename).isDirectory()) {
			yield* scandir(filename);
		} else {
			yield filename;
		}
	}
}

function base64urldecode(str, encoding) {
	// why only have one standard when you can have two?
	str = (str + '==='.slice((str.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/');
	// return new Buffer(str, 'base64');
	return Buffer.from(str, 'base64');
}

function find_function_body(root) {
	for (const node of root) {
		if (node.type == "ExpressionStatement") {
			if (
				node.expression.type == "UnaryExpression" &&
				node.expression.operator == "+" &&
				node.expression.argument.type == "CallExpression" &&
				node.expression.argument.callee.type == "FunctionExpression"
			) {
				return node.expression.argument.callee.body.body;
			} else if (
				node.expression.type == "CallExpression" &&
				node.expression.callee.type == "FunctionExpression"
			) {
				return node.expression.callee.body.body;
			}
		}
	}
}

function find_token_array(root) {
	for (const node of root) {
		if (node.type == "VariableDeclaration") {
			for (const declaration of node.declarations) {
				if (declaration.init && declaration.init.type == "ArrayExpression") {
					return [node.start, node.end, declaration, declaration.id.name];
				}
			}
		}
	}
	return [];
}

function* find_tokens(input, name) {
	if (Array.isArray(input)) {
		for (const node of input) {
			yield* find_tokens(node, name);
		}
	} else if (input instanceof acorn.Node) {
		if (input.type == "FunctionExpression") {
			for (const param of input.params) {
				if (param.name == name) {
					return; // shadowed by function parameter
				}
			}
		}
		if (input.type == "VariableDeclarator" && input.id.name == name) {
			return; // shadowed by variable
		}
		if (
			input.type == "MemberExpression" &&
			input.object.type == "Identifier" &&
			input.object.name == name &&
			input.property.type == "Literal"
		) {
			yield [input.start, input.end, input.property.value];
		} else {
			for (const prop in input) {
				yield* find_tokens(input[prop], name);
			}
		}
	}
}

function iv_from_string(input) {
	// this often leaves part of the iv zero but whatever...
	const iv = new Uint8Array(16);
	for (let i = 0; i < input.length && i < iv.length; ++i) {
		iv[i] = input.charCodeAt(i);
	}
	return iv;
}

// deobfuscators
function deobfuscate_one(filename, input) {
	if (input) {
		const m = input.match(/\+function\(\){(var \w{3}='',\w{3}=\d+-\d+;function \w{3}\(.*?;)var \w{3}=\w{3}\(\w{3},(\w{3}) \);\w{3}\(\d+\);return \d+}\(\)/);
		if (m) {
			const replacement = "+function() {\n"+eval("''+function() { "+m[1]+"return "+m[2]+"; }()")+"\n}();";
			return input.replace(m[0], replacement);
		}
	}
}

function deobfuscate_two(filename, input) {
	if (input) {
		const body = find_function_body(acorn.parse(input).body);
		if (body) {
			const [start, end, arraydef, name] = find_token_array(body);
			if (arraydef) {
				const symbols = eval(input.substring(arraydef.init.start, arraydef.init.end));
				let replacements = [];
				for (const [start, end, value] of find_tokens(body, name)) {
					replacements.push([start, end, symbols[value]]);
				}
				replacements.sort((left, right) => {
					return right[0] - left[0];
				});
				for (const [start, end, replacement] of replacements) {
					input = input.substring(0, start)+JSON.stringify(replacement)+input.substring(end);
				}
				// There are runtime checks for this array
				return input.substring(0, start)+"var "+name+"=[];"+input.substring(end);
			}
		}
	}
}

function deobfuscate_three(filename, input) {
	return deobfuscate_two(filename, deobfuscate_one(filename, input));
}

function deobfuscate_four(filename, input) {
	if (input) {
		const m = input.match(/;\(function\(\){(var \w{3}='',\w{3}=\d+;function \w{3}\(.*?;)var \w{3}=\w{3}\(\w{3},(\w{3}) \);\w{3}\(\); }\)\(\)/);
		if (m) {
			const replacement = ";(function() {\n"+eval("''+function() { "+m[1]+"return "+m[2]+"; }()")+"\n})();";
			return input.replace(m[0], replacement);
		}
	}
}

function deobfuscate_five(filename, input) {
	return deobfuscate_two(filename, deobfuscate_four(filename, input));
}

function deobfuscate() {
	const filelist = {
		"www/js/plugins/DhoomHurdleMinigame.js": deobfuscate_one,
		"www/js/plugins/DhoomYEPSynchFPSAddon.js": deobfuscate_one,
		"www/js/plugins/DhoomLive2DTalk.js": deobfuscate_three,
		"www/js/plugins/DhoomPreCache.js": deobfuscate_three,
		"www/js/plugins/DhoomHangman.js": deobfuscate_one,
		"www/js/plugins/DhoomMapItemShop.js": deobfuscate_one,
		"www/js/plugins/DhoomMessageFacePosition.js": deobfuscate_one,
		"www/js/plugins/DhoomHideMessage.js": deobfuscate_one,
		"www/js/plugins/DhoomVariableHUD.js": deobfuscate_three,
		"www/js/plugins/DhoomClickablePictures.js": deobfuscate_one,
		"www/js/plugins/DhoomEventVision.js": deobfuscate_one,
		"www/js/plugins/DhoomGSQuestSystemAddon.js": deobfuscate_one,
		"www/js/plugins/DhoomNameInputHelp.js": deobfuscate_one,
		"www/js/plugins/DhoomLootRandomizer.js": deobfuscate_one,
		"www/js/plugins/DhoomBOIMinimap.js": deobfuscate_one,
		"www/js/plugins/DhoomTDDPMouseSystemExAddon.js": deobfuscate_one,
		"www/js/plugins/DhoomAccuracyMinigame.js": deobfuscate_one,
		"www/js/plugins/DhoomMobileMainMenu.js": deobfuscate_one,
		"www/js/plugins/DhoomABS.js": deobfuscate_five,
		"www/js/plugins/DhoomGuessNumbers.js": deobfuscate_one,
		"www/js/plugins/ICFSoft_BOIMinimap.js": deobfuscate_five,
		"www/js/plugins/DhoomMobileBank.js": deobfuscate_one,
		"www/js/plugins/DhoomAnimatedTitleBackground.js": deobfuscate_one,
		"www/js/plugins/DhoomMoogleActorsFriendshipAddon.js": deobfuscate_one,
		"www/js/plugins/DhoomPFSearchLimit.js": deobfuscate_one,
		"www/js/plugins/DhoomMessageSkin.js": deobfuscate_one,
		"www/js/plugins/Dhoom4Numbers.js": deobfuscate_five,
		"www/js/plugins/DhoomLive2DTitleScreen.js": deobfuscate_three,
		"www/js/plugins/DhoomNoItemActorSelection.js": deobfuscate_one,
		"www/js/plugins/DhoomItemDisplayHUD.js": deobfuscate_one,
		"www/js/rpg_core.js": deobfuscate_three,
		"www/js/plugins.js": deobfuscate_three,
	};
	for (const filename in filelist) {
		const method = filelist[filename];
		fs.readFile(filename, 'utf8', (err, content) => {
			if (err) throw err;
			content = method(filename, content);
			if (content) {
				fs.writeFile(filename, content, 'utf8', (err) => {
					if (err) throw err;
					console.log(`Deobfuscated ${filename}`);
				});
			}
		});
	}
}

// decryption
// const aes_key = "8bU5mae0qBokfe91IvVGJhQBWDAnoDV8Hmr59388fw2", // 0.3.2
const data_key = "XXXXmae0qBokfe91IvZZZZQBWDAnoDV8QQQQ938XXXX"; // 0.3.3a, 0.4.0p1
const img_key = "HARDmae0qBokfe91IvTiTSQBWDAnoPOEPmr5938C0RE"; // 0.3.3a, 0.4.0p1
//~ const xor_mask = new Buffer("3a76fa9709ca6c0f6d4c9847df430287", "hex"); // 0.3.2
// const xor_mask = new Buffer("0ba9e88858eb6f1d2b521ca7059f96bf", "hex"); // 0.3.3a, 0.4.0p1
const xor_mask = Buffer.from("0ba9e88858eb6f1d2b521ca7059f96bf", "hex"); // 0.3.3a, 0.4.0p1


function decrypt_one(filename, orig_exten) {
	const basename = path.basename(filename, path.extname(filename));
	const original_filename = path.join(path.dirname(filename), basename+orig_exten);
	const iv = iv_from_string(basename.toLowerCase());
	decrypt_aes(filename, original_filename, data_key, iv);
}

function decrypt_two(filename, orig_exten) {
	const basename = path.basename(filename, path.extname(filename));
	const original_filename = path.join(path.dirname(filename), basename+orig_exten);
	decrypt_xor(filename, original_filename, xor_mask);
}

function decrypt_aes(filename, original_filename, key, iv) {
	fs.readFile(filename, (err, input) => {
		if (err) throw err;
		const cipher = crypto.createDecipheriv("aes-256-cbc", base64urldecode(key), iv);
		const output = Buffer.concat([cipher.update(input), cipher.final()]);
		if (output) {
			fs.writeFile(original_filename, output, (err) => {
				if (err) throw err;
				fs.unlinkSync(filename);
				const basename = path.basename(original_filename);
				console.log(`Decrypted ${filename} -> ${basename}`);
			});
		}
	});
}

function decrypt_xor(filename, original_filename, mask) {
	// skip the first 16 "header" bytes
	// then, run a silly XOR over the next 16 bytes
	fs.readFile(filename, (err, input) => {
		if (err) throw err;
		for (let i = 0; i < 16; ++i) {
			input[i + 16] = input[i + 16] ^ mask[i];
		}
		fs.writeFile(original_filename, input.slice(16), (err) => {
			if (err) throw err;
			fs.unlinkSync(filename);
			const basename = path.basename(original_filename);
			console.log(`Decrypted ${filename} -> ${basename}`);
		});
	});
}

function decrypt_three(filename, orig_exten) {
	const basename = path.basename(filename, path.extname(filename));
	const orig_basename = LZString.decompressFromBase64(basename);
	const original_filename = path.join(path.dirname(filename), orig_basename+orig_exten);
	const iv = iv_from_string(orig_basename);
	decrypt_aes(filename, original_filename, img_key, iv);
}

function decrypt() {
	const filelist = [
		["www/data", ".soldata", ".json", decrypt_one],
		["www/audio", ".rpgmvo", ".ogg", decrypt_two],
		["www/img/achievements", ".rpgmvp", ".png", decrypt_two],
		["www/img/animations", ".rpgmvp", ".png", decrypt_two],
		["www/img/characters", ".rpgmvp", ".png", decrypt_two],
		["www/img/characters", ".soldata", ".png", decrypt_three],
		["www/img/faces", ".soldata", ".png", decrypt_three],
		["www/img/numbergame", ".soldata", ".png", decrypt_three],
		["www/img/parallaxes", ".soldata", ".png", decrypt_three],
		["www/img/battlebacks1", ".rpgmvp", ".png", decrypt_two],
		["www/img/pictures", ".rpgmvp", ".png", decrypt_two],
		["www/img/pictures", ".soldata", ".png", decrypt_three],
		["www/img/system", ".rpgmvp", ".png", decrypt_two],
		["www/img/tilesets", ".soldata", ".png", decrypt_three],
		["www/img/titles2", ".soldata", ".png", decrypt_three],
		["www/l2d", ".soldata", ".png", decrypt_three],
	];
	for (const [dir, exten, orig_exten, method] of filelist) {
		for (const filename of scandir(dir)) {
			if (path.extname(filename) == exten) {
				method(filename, orig_exten);
			}
		}
	}
}

deobfuscate();
decrypt();
