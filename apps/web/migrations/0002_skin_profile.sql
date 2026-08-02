-- Skin-tone colour profile, determined once rather than re-derived from every
-- outfit photo.
--
-- Still no column for ethnicity, race, or nationality. `skin_depth` records how
-- light or dark skin appears, in three coarse buckets, because colour matching
-- needs it — and `skin_source` records whether the reading came from a photo,
-- the quiz, or the user correcting it by hand, so a model guess is never
-- mistaken for something the user told us.

ALTER TABLE users ADD COLUMN skin_undertone   TEXT;
ALTER TABLE users ADD COLUMN skin_depth       TEXT;
ALTER TABLE users ADD COLUMN skin_contrast    TEXT;
ALTER TABLE users ADD COLUMN skin_confidence  TEXT;
ALTER TABLE users ADD COLUMN skin_source      TEXT;
ALTER TABLE users ADD COLUMN skin_note        TEXT;
ALTER TABLE users ADD COLUMN skin_updated_at  TEXT;
