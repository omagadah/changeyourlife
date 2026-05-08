/**
 * Cloud Functions — Change Your Life
 * Callable functions: addXp, setUserRole, getMyRole
 *
 * Bootstrap : la première fois, ajouter `ROOT_ADMIN_UID` dans les env vars
 * Firebase (`firebase functions:config:set admin.root_uid="..."` ou via
 * variables d'environnement Cloud Functions). Ce UID a automatiquement
 * accès à `setUserRole` même sans custom claim.
 */

import {setGlobalOptions} from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

try { admin.initializeApp(); } catch (e) { /* already initialized */ }

setGlobalOptions({ maxInstances: 10 });

// ── XP ─────────────────────────────────────────────────────────────────────
type Domain = "body" | "etre" | "heart" | "order" | "mind";
interface LevelState { level: number; xp: number; nextXp: number }
interface Levels { body: LevelState; etre?: LevelState; mind?: LevelState; heart: LevelState; order: LevelState }

function defaultLevels(): Levels {
	return {
		body: { level: 0, xp: 0, nextXp: 100 },
		etre: { level: 0, xp: 0, nextXp: 100 },
		heart: { level: 0, xp: 0, nextXp: 100 },
		order: { level: 0, xp: 0, nextXp: 100 },
	};
}

function normalizeLevels(l: any): Levels {
	const base = defaultLevels();
	const levels = (l || {}) as Levels;
	if (!levels.etre && levels.mind) {
		levels.etre = levels.mind;
	}
	return { ...base, ...levels };
}

function nextThreshold(currentLevel: number): number {
	return 100 + currentLevel * 20;
}

export const addXp = onCall({ cors: true }, async (req) => {
	const uid = req.auth?.uid;
	if (!uid) {
		logger.warn("addXp called without auth");
		throw new HttpsError("unauthenticated", "Auth required");
	}
	const { domain, amount } = req.data || {};
	const validDomains: Domain[] = ["body", "etre", "heart", "order", "mind"];
	if (!validDomains.includes(domain)) {
		throw new HttpsError("invalid-argument", "invalid-domain");
	}
	const inc = Number(amount || 0);
	if (!Number.isFinite(inc) || inc <= 0 || inc > 10000) {
		throw new HttpsError("invalid-argument", "invalid-amount");
	}

	const db = admin.firestore();
	const ref = db.collection("users").doc(uid);
	await db.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		const data = snap.exists ? (snap.data() as any) : {};
		const levels: Levels = normalizeLevels(data.levels || defaultLevels());
		const key: "body" | "etre" | "heart" | "order" = (domain === "mind" ? "etre" : domain);
		const cur = (levels as any)[key] || { level: 0, xp: 0, nextXp: 100 };
		let xp = cur.xp + inc;
		let level = cur.level;
		let nextXp = cur.nextXp || nextThreshold(level);

		while (xp >= nextXp) {
			xp -= nextXp;
			level += 1;
			nextXp = nextThreshold(level);
		}

		(levels as any)[key] = { level, xp, nextXp };
		tx.set(ref, { levels }, { merge: true });
	});

	return { ok: true };
});

// ── Roles & Custom Claims ──────────────────────────────────────────────────

type Role = "admin" | "mod" | "user";
const VALID_ROLES: Role[] = ["admin", "mod", "user"];

/** UID du super-admin bootstrap. Configuré via env var `ROOT_ADMIN_UID`.
 *  Permet de démarrer le système sans œuf-et-poule. À retirer/transférer
 *  une fois qu'un autre admin a été créé via custom claim. */
function getRootAdminUid(): string | null {
	return (process.env.ROOT_ADMIN_UID || "").trim() || null;
}

function isCallerAdmin(req: any): boolean {
	if (!req.auth?.uid) return false;
	const root = getRootAdminUid();
	if (root && req.auth.uid === root) return true;
	return req.auth.token?.role === "admin";
}

/** Lecture du rôle courant — utile pour la UI client (cache du custom claim).
 *  Toujours autorisé pour l'utilisateur lui-même. */
export const getMyRole = onCall({ cors: true }, async (req) => {
	const uid = req.auth?.uid;
	if (!uid) {
		throw new HttpsError("unauthenticated", "Auth required");
	}
	const claims = req.auth?.token || {};
	const root = getRootAdminUid();
	const role: Role = (root && uid === root) ? "admin" : (claims.role as Role) || "user";
	return { role, uid };
});

/** Définit le rôle d'un user (custom claim + miroir Firestore pour read).
 *  Réservé aux admins (ou au ROOT_ADMIN_UID bootstrap). */
export const setUserRole = onCall({ cors: true }, async (req) => {
	if (!isCallerAdmin(req)) {
		logger.warn("setUserRole denied", { caller: req.auth?.uid });
		throw new HttpsError("permission-denied", "Admin requis");
	}
	const { uid: targetUid, role } = req.data || {};
	if (typeof targetUid !== "string" || !targetUid.length) {
		throw new HttpsError("invalid-argument", "uid manquant");
	}
	if (!VALID_ROLES.includes(role)) {
		throw new HttpsError("invalid-argument", "role invalide (admin|mod|user)");
	}

	// Refuse de retirer le rôle du ROOT_ADMIN
	const root = getRootAdminUid();
	if (root && targetUid === root && role !== "admin") {
		throw new HttpsError("failed-precondition", "Le ROOT_ADMIN_UID ne peut pas être déclassé");
	}

	// 1. Custom claim (source de vérité pour l'auth)
	const newClaims: any = role === "user" ? {} : { role };
	await admin.auth().setCustomUserClaims(targetUid, newClaims);

	// 2. Miroir Firestore (pour lecture côté client par l'owner)
	const db = admin.firestore();
	await db.collection("roles").doc(targetUid).set(
		{ role, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: req.auth?.uid },
		{ merge: true },
	);

	logger.info("setUserRole", { caller: req.auth?.uid, target: targetUid, role });
	return { ok: true, uid: targetUid, role };
});
