// Public profiles, followers and the activity feed.
const express = require("express");
const { createRateLimiter } = require("../middleware/rate-limit");
const { authenticateToken, readBearerToken, requireUser } = require("../session");
const library = require("../db/library");
const social = require("../db/social");
const { findUserByUsername } = require("../db/users");
const { publicList, publicText } = require("./library");

const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;
const SEARCH_MAX_LENGTH = 60;

const readLimiter = createRateLimiter({ keyPrefix: "public-read", windowMs: 60 * 1000, max: 90 });
const followLimiter = createRateLimiter({
  keyPrefix: "follow",
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Muitas acoes de seguir em pouco tempo. Aguarde alguns minutos."
});

function fail(res, status, code, message) {
  res.status(status).json({ ok: false, code, message });
}

function notFound(res) {
  // Same answer for "does not exist" and "is private", so profiles cannot be enumerated.
  fail(res, 404, "PROFILE_NOT_FOUND", "Perfil nao encontrado ou privado.");
}

function mapPerson(row) {
  return { nome: publicText(row.nome, 80), username: String(row.username || "") };
}

// Loads a user whose profile is public, or null.
async function findPublicUser(rawUsername) {
  const username = String(rawUsername || "").trim().toLowerCase();
  if (!USERNAME_REGEX.test(username)) return null;

  const user = await findUserByUsername(username);
  const row = user ? await library.getLibrary(user.id) : null;
  return row?.publico ? { user, row } : null;
}

// The viewer is optional on public routes: a bad or missing token just means "anonymous".
async function optionalViewer(req) {
  const token = readBearerToken(req);
  return token ? authenticateToken(token).catch(() => null) : null;
}

const router = express.Router();

router.get("/", readLimiter, async (req, res) => {
  const term = String(req.query.q || "").trim().slice(0, SEARCH_MAX_LENGTH);
  const people = await social.searchPublicProfiles(term);
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, people: people.map(mapPerson) });
});

router.get("/:username", readLimiter, async (req, res) => {
  const found = await findPublicUser(req.params.username);

  if (!found) {
    notFound(res);
    return;
  }

  const { user, row } = found;
  const dados = row.dados || {};
  const viewer = await optionalViewer(req);
  const isSelf = Boolean(viewer && String(viewer.id) === String(user.id));

  res.set("Cache-Control", "private, no-store");
  res.json({
    ok: true,
    profile: {
      nome: publicText(user.nome, 80),
      username: user.username,
      membroDesde: user.criado_em || null,
      ...(await social.counts(user.id)),
      voceSegue: viewer && !isSelf ? await social.isFollowing(viewer.id, user.id) : false,
      ehVoce: isSelf,
      albumFavorites: publicList(dados.albumFavorites, 48),
      bandFavorites: publicList(dados.bandFavorites, 48),
      collections: (Array.isArray(dados.collections) ? dados.collections : []).slice(0, 24).map((collection) => ({
        name: publicText(collection?.name, 80),
        items: publicList((collection?.items || []).map((saved) => saved?.item), 48)
      }))
    }
  });
});

router.get("/:username/followers", readLimiter, async (req, res) => {
  const found = await findPublicUser(req.params.username);
  if (!found) return notFound(res);
  res.json({ ok: true, people: (await social.listFollowers(found.user.id)).map(mapPerson) });
});

router.get("/:username/following", readLimiter, async (req, res) => {
  const found = await findPublicUser(req.params.username);
  if (!found) return notFound(res);
  res.json({ ok: true, people: (await social.listFollowing(found.user.id)).map(mapPerson) });
});

router.post("/:username/follow", followLimiter, requireUser, async (req, res) => {
  const found = await findPublicUser(req.params.username);
  if (!found) return notFound(res);

  if (String(found.user.id) === String(req.user.id)) {
    fail(res, 400, "CANNOT_FOLLOW_SELF", "Voce nao pode seguir a si mesmo.");
    return;
  }

  await social.follow(req.user.id, found.user.id);
  res.json({ ok: true, voceSegue: true, ...(await social.counts(found.user.id)) });
});

router.delete("/:username/follow", followLimiter, requireUser, async (req, res) => {
  const username = String(req.params.username || "").trim().toLowerCase();
  // Unfollowing works even if the profile went private in the meantime.
  const user = USERNAME_REGEX.test(username) ? await findUserByUsername(username) : null;
  if (!user) return notFound(res);

  await social.unfollow(req.user.id, user.id);
  res.json({ ok: true, voceSegue: false, ...(await social.counts(user.id)) });
});

const feedRouter = express.Router();

feedRouter.get("/", readLimiter, requireUser, async (req, res) => {
  const rows = await social.feedFor(req.user.id);
  res.set("Cache-Control", "no-store");
  res.json({
    ok: true,
    items: rows.map((row) => ({
      ...mapPerson(row),
      atualizadoEm: row.atualizado_em ? new Date(row.atualizado_em).getTime() : 0,
      albumFavorites: publicList(row.dados?.albumFavorites, 4),
      bandFavorites: publicList(row.dados?.bandFavorites, 3)
    }))
  });
});

module.exports = {
  feedRouter,
  usersRouter: router
};
