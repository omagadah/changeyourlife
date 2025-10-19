/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

try { admin.initializeApp(); } catch (e) { /* already initialized */ }

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// helloWorld example removed; using callable functions below

type Domain = "body" | "mind" | "heart" | "order";
interface LevelState { level: number; xp: number; nextXp: number }
interface Levels { body: LevelState; mind: LevelState; heart: LevelState; order: LevelState }

function defaultLevels(): Levels {
	return {
		body: { level: 0, xp: 0, nextXp: 100 },
		mind: { level: 0, xp: 0, nextXp: 100 },
		heart: { level: 0, xp: 0, nextXp: 100 },
		order: { level: 0, xp: 0, nextXp: 100 },
	};
}

function nextThreshold(currentLevel: number): number {
	// Simple curve: 100 + 20*level (tune later)
	return 100 + currentLevel * 20;
}

export const addXp = onCall({ cors: true }, async (req) => {
	const uid = req.auth?.uid;
	if (!uid) {
		logger.warn("addXp called without auth");
		throw new Error("unauthenticated");
	}
	const { domain, amount } = req.data || {};
	const validDomains: Domain[] = ["body","mind","heart","order"];
	if (!validDomains.includes(domain)) {
		throw new Error("invalid-domain");
	}
	const inc = Number(amount || 0);
	if (!Number.isFinite(inc) || inc <= 0 || inc > 10000) {
		throw new Error("invalid-amount");
	}

	const db = admin.firestore();
	const ref = db.collection("users").doc(uid);
	await db.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		const data = snap.exists ? snap.data() as any : {};
		const levels: Levels = data.levels || defaultLevels();
		const cur = levels[domain as Domain] || { level: 0, xp: 0, nextXp: 100 };
		let xp = cur.xp + inc;
		let level = cur.level;
		let nextXp = cur.nextXp || nextThreshold(level);

		// handle multiple level-ups if a big amount
		while (xp >= nextXp) {
			xp -= nextXp;
			level += 1;
			nextXp = nextThreshold(level);
		}

		levels[domain as Domain] = { level, xp, nextXp };
		tx.set(ref, { levels }, { merge: true });
	});

	return { ok: true };
});
