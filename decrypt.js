"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const acorn = require("./lib/acorn");
const LZString = require("./lib/lz-string.js");

const FALLBACK_DATA_KEYS = [
	"8bU5mae0qBokfe91IvVGJhQBWDAnoDV8Hmr59388fw2", // iirc it's up to 0.3.2
];
const FALLBACK_IMG_KEYS = [
	"HARDmae0qBokfe91IvTiTSQBWDAnoPOEPmr5938C0RE", // 0.3.3a, 0.4.0p1
	"8bU5mae0qBokfe91IvVGJhQBWDAnoDV8Hmr59388fw2", // iirc it's up to 0.3.2
];
const FALLBACK_XOR_MASKS = [
	Buffer.from("0ba9e88858eb6f1d2b521ca7059f96bf", "hex"), // 0.3.3a, 0.4.0p1
	Buffer.from("3a76fa9709ca6c0f6d4c9847df430287", "hex"), // 0.3.2
];

// utilities
function* scandir(dir) {
	if (!fs.existsSync(dir)) return;
	for (let filename of fs.readdirSync(dir)) {
		filename = path.join(dir, filename);
		if (fs.statSync(filename).isDirectory()) {
			yield* scandir(filename);
		} else {
			yield filename;
		}
	}
}

function base64urldecode(str) {
	// why only have one standard when you can have two?
	str = (str + '==='.slice((str.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/');
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
		const m = input.match(/\+function\(\)\s*\{(var \w+='',\s*\w+=\d+-\d+;function \w+\(.*?;)var \w+=\w+\(\w+,\s*(\w+)\s*\);\w+\(\d+\);return \d+\}\(\)/);
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
		const m = input.match(/;\(function\(\)\s*\{(var \w+='',\s*\w+=\d+;function \w+\(.*?;)var \w+=\w+\(\w+,\s*(\w+)\s*\);\w+\(\);\s*\}\)\(\)/);
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
		if (!fs.existsSync(filename)) continue;
		const method = filelist[filename];
		const raw = fs.readFileSync(filename, 'utf8');
		const content = method(filename, raw);
		if (content) {
			fs.writeFileSync(filename, content, 'utf8');
			console.log(`Deobfuscated ${filename}`);
		}
	}
}

function extractKeys() {
	let dataKey = null;
	let imgKey = null;
	let xorMask = null;
	const candidates = new Set();

	const jsFiles = [
		"www/js/rpg_core.js",
		"www/js/plugins.js",
		...scandir("www/js/plugins"),
	];

	const keyRegex = /["']([A-Za-z0-9_-]{43})["']/g;
	const xorRegex = /["']([0-9a-fA-F]{32})["']/g;

	for (const file of jsFiles) {
		if (!fs.existsSync(file) || path.extname(file) !== ".js") continue;
		const code = fs.readFileSync(file, "utf8");

		if (code.includes("aes-256-cbc") || code.includes("createDecipheriv") || code.includes("soldata")) {
			for (const match of code.matchAll(keyRegex)) {
				const candidate = match[1];
				if (/^[0-9a-fA-F]+$/.test(candidate)) continue;
				candidates.add(candidate);

				const windowStart = Math.max(0, match.index - 400);
				const windowEnd = Math.min(code.length, match.index + 400);
				const context = code.slice(windowStart, windowEnd);

				if (context.includes("decompressFromBase64") || context.includes("LZString")) {
					imgKey = candidate;
				} else if (context.includes("DataManager") || context.includes("loadDataFile") || context.includes("toLowerCase")) {
					dataKey = candidate;
				}
			}
		}

		if (!xorMask && file.endsWith("rpg_core.js")) {
			for (const match of code.matchAll(xorRegex)) {
				const windowStart = Math.max(0, match.index - 300);
				const windowEnd = Math.min(code.length, match.index + 300);
				const context = code.slice(windowStart, windowEnd);
				if (context.includes("Decrypter") || context.includes("encryptionKey") || context.includes("_encryptionKey")) {
					xorMask = Buffer.from(match[1], "hex");
					break;
				}
			}
		}
	}

	if (candidates.size === 2) {
		const [first, second] = [...candidates];
		if (imgKey && !dataKey) dataKey = first === imgKey ? second : first;
		if (dataKey && !imgKey) imgKey = first === dataKey ? second : first;
	}

	const dataKeys = [...new Set([dataKey, ...candidates, ...FALLBACK_DATA_KEYS].filter(Boolean))];
	const imgKeys = [...new Set([imgKey, ...candidates, ...FALLBACK_IMG_KEYS].filter(Boolean))];
	const xorMasks = xorMask ? [xorMask, ...FALLBACK_XOR_MASKS] : FALLBACK_XOR_MASKS;

	console.log(`Candidate data_keys: ${dataKeys.join(", ")}`);
	console.log(`Candidate img_keys: ${imgKeys.join(", ")}`);
	console.log(`Candidate xor_masks: ${xorMasks.map((m) => m.toString("hex")).join(", ")}`);

	return { dataKeys, imgKeys, xorMasks };
}

function isValidHeader(buf, exten) {
	if (exten === ".png") {
		return buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
	}
	if (exten === ".ogg") {
		return buf.length >= 4 && buf.subarray(0, 4).toString("ascii") === "OggS";
	}
	if (exten === ".json") {
		const text = buf.toString("utf8").trimStart();
		return text.startsWith("{") || text.startsWith("[");
	}
	return true;
}

function decrypt_aes(filename, original_filename, keys, iv) {
	const input = fs.readFileSync(filename);
	const orig_exten = path.extname(original_filename);

	for (const key of keys) {
		try {
			const cipher = crypto.createDecipheriv("aes-256-cbc", base64urldecode(key), iv);
			const output = Buffer.concat([cipher.update(input), cipher.final()]);
			if (output.length > 0 && isValidHeader(output, orig_exten)) {
				fs.writeFileSync(original_filename, output);
				fs.unlinkSync(filename);
				const basename = path.basename(original_filename);
				console.log(`Decrypted ${filename} -> ${basename}`);
				return;
			}
		} catch (_) {
			// Try next candidate key
		}
	}
	console.warn(`Failed to decrypt ${filename}: no valid key matched`);
}

function decrypt_xor(filename, original_filename, masks) {
	// skip the first 16 "header" bytes
	// then, run a silly XOR over the next 16 bytes
	const raw = fs.readFileSync(filename);
	const orig_exten = path.extname(original_filename);

	for (const mask of masks) {
		const input = Buffer.from(raw);
		for (let i = 0; i < 16; ++i) {
			input[i + 16] = input[i + 16] ^ mask[i];
		}
		const output = input.subarray(16);
		if (isValidHeader(output, orig_exten)) {
			fs.writeFileSync(original_filename, output);
			fs.unlinkSync(filename);
			const basename = path.basename(original_filename);
			console.log(`Decrypted ${filename} -> ${basename}`);
			return;
		}
	}
	console.warn(`Failed to decrypt ${filename}: no valid XOR mask matched`);
}

function decrypt(keys) {
	function decrypt_one(filename, orig_exten) {
		const basename = path.basename(filename, path.extname(filename));
		const original_filename = path.join(path.dirname(filename), basename+orig_exten);
		const iv = iv_from_string(basename.toLowerCase());
		decrypt_aes(filename, original_filename, keys.dataKeys, iv);
	}

	function decrypt_two(filename, orig_exten) {
		const basename = path.basename(filename, path.extname(filename));
		const original_filename = path.join(path.dirname(filename), basename+orig_exten);
		decrypt_xor(filename, original_filename, keys.xorMasks);
	}

	function decrypt_three(filename, orig_exten) {
		const basename = path.basename(filename, path.extname(filename));
		const orig_basename = LZString.decompressFromBase64(basename);
		if (!orig_basename) {
			console.warn(`Skipped ${filename}: failed to decode LZString basename`);
			return;
		}
		const original_filename = path.join(path.dirname(filename), orig_basename+orig_exten);
		const iv = iv_from_string(orig_basename);
		decrypt_aes(filename, original_filename, keys.imgKeys, iv);
	}

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
const keys = extractKeys();
decrypt(keys);
