-- Phase 32: bulk-load Principal/Asst Principal/Front Desk/Nurse data
-- Michelle pasted in chat, across Elementary/Middle/High School.
--
-- Only sets a column when the pasted sheet actually had a real value for
-- it -- a blank cell, "-", or "?" in the sheet means "don't know yet",
-- so that column is left completely untouched here (whatever's already
-- in contact_rows for it stays as-is; this never overwrites existing
-- data with a blank).
--
-- Each school's update is wrapped in a DO block that RAISE NOTICEs if
-- zero rows matched -- run this in the Supabase SQL editor and check
-- the "Messages"/output panel for any "NO MATCH" lines afterward. A
-- no-match means either the school doesn't exist yet in Contacts (add
-- it first, or check the group is right), or its name in contact_rows
-- doesn't contain the substring guessed below (rename the pattern to
-- match and re-run just that one block).
--
-- Nurse Name/Email use one name per line as usual (see
-- components/contacts-list.tsx) for schools with more than one nurse.
--
-- The "❗️" flags from Michelle's original spreadsheet are kept as part
-- of the name text itself (not stripped) -- they're hers to interpret,
-- this SQL doesn't guess what they mean, just preserves them.
--
-- Where the spreadsheet had an extra remark for a school (Michelle's
-- screenshot confirmed these), it's written into that row's own
-- `notes` column -- the same free-text field the Contacts page's edit
-- form already shows -- not just left as a SQL comment, so it's
-- actually visible in the app. Each is appended rather than
-- overwritten (existing notes, if any, are kept above it) and guarded
-- so re-running this script doesn't duplicate the same note twice.

-- ============================= ELEMENTARY =============================

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'John Kelly', principal_email = 'johnlkelly@bpsma.org',
    asst_principal = 'Adriena Newhalen', asst_principal_email = 'adriennewhalen@bpsma.org',
    front_desk = '❗️Kat Porzelt', front_desk_email = 'kathleenporzelt@bpsma.org',
    nurse_name = E'❗️Amanda Phillips\nLaurie Abban', nurse_email = E'amandaphillips@bpsma.org\nlaurieabban@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%elementary%' AND cr.school ILIKE '%angelo%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Angelo (Elementary)'; END IF;
END $$;

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Carolyn Copp', principal_email = 'carolynacopp@bpsma.org',
    asst_principal = 'Nicole Ford', asst_principal_email = 'nicolejford@bpsma.org',
    front_desk = 'Princesse Bouzi', front_desk_email = 'princessebouzi@bpsma.org',
    nurse_name = '❗️Casey Dimitri', nurse_email = 'caseydimitri@bpsma.org',
    notes = CASE
      WHEN COALESCE(notes, '') = '' THEN 'Ask if there''s another nurse also covering the front desk, since Ayla moved to a new school.'
      WHEN notes NOT LIKE '%Ayla moved to a new school%' THEN notes || E'\n\n' || 'Ask if there''s another nurse also covering the front desk, since Ayla moved to a new school.'
      ELSE notes
    END
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%elementary%' AND cr.school ILIKE '%arnone%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Arnone (Elementary)'; END IF;
END $$;

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Jane Werb', principal_email = 'janeewerb@bpsma.org',
    asst_principal = 'Valerie Brower-Foote', asst_principal_email = 'valerieabrower@bpsma.org',
    front_desk = 'Diane Golding', front_desk_email = 'dianegolding@bpsma.org',
    nurse_name = '❗️Lynn Adams', nurse_email = 'lynnadams@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%elementary%' AND cr.school ILIKE '%baker%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Baker (Elementary)'; END IF;
END $$;

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Michael Smith', principal_email = 'michaelasmith@bpsma.org',
    asst_principal = 'Mike McKenna', asst_principal_email = 'michaelcmckenna@bpsma.org',
    front_desk = '❗️Vera Morris', front_desk_email = 'veramorris@bpsma.org',
    nurse_name = 'Melissa Hughes', nurse_email = 'melissahughes@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%elementary%' AND cr.school ILIKE '%brookfield%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Brookfield (Elementary)'; END IF;
END $$;

-- Downey: Michelle's screenshot shows "Doreen Allen Kellum" struck
-- through (crossed out) -- outdated, not the current nurse -- with the
-- note naming her actual replacements, so the crossed-out name/email
-- is left out of nurse_name/nurse_email entirely rather than written
-- in and then contradicted by the note underneath it.
DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Yolanda Difalco', principal_email = 'yolandadifalco@bpsma.org',
    asst_principal = 'Jennifer Colburn', asst_principal_email = 'jennifercolburn@bpsma.org',
    front_desk = '❗️Tina Kusick', front_desk_email = 'TINAMARIEKUSICK@bpsma.org',
    nurse_name = E'Jacinta Tribou\nKendra DaCosta',
    notes = CASE
      WHEN COALESCE(notes, '') = '' THEN 'Ask Tina Kusick for the new nurses'' email addresses (Jacinta Tribou, Kendra DaCosta) -- "Doreen Allen Kellum" is outdated, no longer the nurse here.'
      WHEN notes NOT LIKE '%Jacinta Tribou%' THEN notes || E'\n\n' || 'Ask Tina Kusick for the new nurses'' email addresses (Jacinta Tribou, Kendra DaCosta) -- "Doreen Allen Kellum" is outdated, no longer the nurse here.'
      ELSE notes
    END
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%elementary%' AND cr.school ILIKE '%downey%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Downey (Elementary)'; END IF;
END $$;

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Natalie L. Pohl', principal_email = 'natalielpohl@bpsma.org',
    asst_principal = 'Ines Enos', asst_principal_email = 'inesenos@bpsma.org',
    front_desk = 'Laura Rodriguez', front_desk_email = 'laurarodriguez@bpsma.org',
    nurse_name = E'❗️Denice Lewis\nKrista Morselli', nurse_email = E'denicelewis@bpsma.org\nkristamorselli@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%elementary%' AND cr.school ILIKE '%george%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: George (Elementary)'; END IF;
END $$;

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Colleen Proudler',
    asst_principal = 'Adam St. Peter', asst_principal_email = 'adamrstpeter@bpsma.org',
    front_desk = 'Grace',
    nurse_name = '❗️Diane Sloane', nurse_email = 'dianesloane@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%elementary%' AND cr.school ILIKE '%gilmore%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Gilmore (Elementary)'; END IF;
END $$;
-- Gilmore: Colleen Proudler's email and Grace's (front desk) last name
-- and email are all missing from the sheet ("-" / "?").

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Stephen Shaw-Lyon', principal_email = 'stephenpshaw@bpsma.org',
    asst_principal = 'Gina Greedon', asst_principal_email = 'ginacreedon@bpsma.org',
    front_desk = 'Gyannah Devine', front_desk_email = 'gyannahdevine@bpsma.org',
    nurse_name = 'Guirlin Remy', nurse_email = 'GUIRLINEREMY@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%elementary%' AND cr.school ILIKE '%hancock%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Hancock (Elementary)'; END IF;
END $$;
-- Hancock: sheet spells the asst principal "Gina Greedon" but her
-- email is ginacreedon@bpsma.org (Creedon) -- kept the name exactly as
-- given; worth double-checking which spelling is right.

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Kelly Kistler', principal_email = 'kellykistler@bpsma.org',
    asst_principal = 'Whitney Skinner', asst_principal_email = 'whitneyskinner@bpsma.org',
    front_desk = 'Ronise Vieira', front_desk_email = 'ronisedvieira@bpsma.org',
    nurse_name = '❗️Regina Papp, Bs, M.Ed., Rn', nurse_email = 'reginapapp@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%elementary%' AND (cr.school ILIKE '%kenndey%' OR cr.school ILIKE '%kennedy%');
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Kennedy (Elementary)'; END IF;
END $$;

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Leah Blake Mcketty', principal_email = 'leahmcketty@bpsma.org',
    asst_principal = 'Renee Sanger', asst_principal_email = 'reneeasanger@bpsma.org',
    front_desk = 'Michelle Sheehan / Jane Ponder', front_desk_email = 'MICHELLEDSHEEHAN@bpsma.org / janeponder@bpsma.org',
    nurse_name = 'Ana Carpenter', nurse_email = 'Anacarpenter@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%elementary%' AND cr.school ILIKE '%raymond%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Raymond (Elementary)'; END IF;
END $$;

-- NOT applied: "old - Mark Prince markprince@bpsma.org" -- unclear
-- which school this is a former/retired principal for. Ask Michelle
-- which row this belongs to (or whether it should go in that school's
-- Notes as a "former principal" note instead of the Principal field).

-- ============================= MIDDLE SCHOOL =============================

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Barbara Lovell', principal_email = 'barbarajlovell@bpsma.org',
    asst_principal = 'Troy Kieltyka / Charlene Mont-Rond', asst_principal_email = 'troykieltyka@bpsma.org / charlenemontrond@bpsma.org',
    front_desk = 'Kristin Miett', front_desk_email = 'KRISTINMIETT@bpsma.org',
    nurse_name = E'❗️Rachel Furman\nMarleine Rosembert', nurse_email = E'rachelfurman@bpsma.org\nMARLEINEROSEMBERT@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%middle%' AND cr.school ILIKE '%ashfield%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Ashfield (Middle)'; END IF;
END $$;

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Tracy Culta-Monteiro',
    front_desk = 'John Lynch', front_desk_email = 'JOHNLYNCH@bpsma.org / LISAGREIN@bpsma.org',
    nurse_name = '❗️Ann Nardelli', nurse_email = 'ANNNARDELLI@bpsma.org',
    notes = CASE
      WHEN COALESCE(notes, '') = '' THEN 'No contact details listed for the new Assistant Principal on the school website.'
      WHEN notes NOT LIKE '%new Assistant Principal on the school website%' THEN notes || E'\n\n' || 'No contact details listed for the new Assistant Principal on the school website.'
      ELSE notes
    END
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%middle%' AND cr.school ILIKE '%east%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: East (Middle)'; END IF;
END $$;
-- East: Asst Principal wasn't set -- the sheet lists "Denise Glennon"
-- as the name but "JONGARCEA@bpsma.org" as her email, which is South
-- Middle's Asst Principal's email (Jon Garcea) -- looks like a
-- copy/paste mix-up in the original sheet, so left blank rather than
-- save a wrong email.

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Meghann Bottome',
    nurse_name = '❗️Astride Jeune', nurse_email = 'ASTRIDEJEUNE@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%middle%' AND cr.school ILIKE '%brockton therapeutic%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Brockton Therapeutic (Middle)'; END IF;
END $$;

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Alison Ramsay', principal_email = 'alisonaramsay@bpsma.org',
    asst_principal = 'Susan Cole', asst_principal_email = 'susanecole@bpsma.org',
    front_desk = 'Nicole Bethnomey', front_desk_email = 'nicolebethomey@bpsma.com',
    nurse_name = '❗️Kimberly Baldi', nurse_email = 'kimberlybaldi@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%middle%' AND cr.school ILIKE '%north%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: North (Middle)'; END IF;
END $$;
-- North: front desk email is "...@bpsma.com" (.com, not .org) in the
-- original sheet -- kept exactly as given, worth double-checking it's
-- not a typo.

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Lisa G. Thomas', principal_email = 'lisathomas@bpsma.org',
    asst_principal = 'Jon Garcea', asst_principal_email = 'jongarcea@bpsma.org',
    front_desk = 'Xashary Sabater', front_desk_email = 'xasharysabater@bpsma.com / xasharysabater@bpsma.org',
    nurse_name = '❗️Kerry Rodrick', nurse_email = 'KERRYRODRICK@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%middle%' AND cr.school ILIKE '%south%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: South (Middle)'; END IF;
END $$;

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Sean Ahern', principal_email = 'seanahern@bpsma.org',
    asst_principal = 'Eric Wescott', asst_principal_email = 'ericwescott@bpsma.org',
    front_desk = 'Jaime Estee', front_desk_email = 'jaimebestee@bpsma.org',
    nurse_name = E'❗️Francisca Andrade\n❗️Nancy White\nColleen Elchami', nurse_email = E'franciscaandrade@bpsma.org\nnancywhite@bpsma.org\nCOLLEENELCHAMI@bpsma.org',
    notes = CASE
      WHEN COALESCE(notes, '') = '' THEN 'From the school website: Sean Ahern is Principal, Jaime Estee is Associate Principal.'
      WHEN notes NOT LIKE '%Jaime Estee is Associate Principal%' THEN notes || E'\n\n' || 'From the school website: Sean Ahern is Principal, Jaime Estee is Associate Principal.'
      ELSE notes
    END
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%middle%' AND cr.school ILIKE '%plouffe%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Plouffe (Middle)'; END IF;
END $$;

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Carlton Campbell', principal_email = 'carltonlcampbell@bpsma.org',
    asst_principal = 'Carolyn MacKinnon', asst_principal_email = 'carolynmmackinnon@bpsma.org',
    front_desk = '❗️Tanya Lincoln', front_desk_email = 'tanyalincoln@bpsma.org',
    nurse_name = '❗️Lisa Jezaed', nurse_email = 'lisajezard@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%middle%' AND cr.school ILIKE '%west%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: West (Middle)'; END IF;
END $$;
-- West: nurse's name is spelled "Jezaed" but her email is
-- lisajezard@bpsma.org (Jezard) -- kept the name exactly as given,
-- worth double-checking which spelling is right.

-- ============================= HIGH SCHOOL =============================

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Kevin Rooney', principal_email = 'KEVINROONEY@bpsma.org',
    asst_principal = 'Joanna Hrenko', asst_principal_email = 'JOANNAHRENKO@bpsma.org',
    nurse_name = 'Noel Lefoye', nurse_email = 'Noellefoye@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%high%' AND cr.school ILIKE '%davis%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Davis (High)'; END IF;
END $$;

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Cynthia Burns', principal_email = 'CYNTHIAEBURNS@bpsma.org',
    front_desk = 'Danina Rodrigues', front_desk_email = 'DANINARODRIGUES@bpsma.org',
    nurse_name = '❗️Darcie Edwards', nurse_email = 'DARCIEEDWARDS@bpsma.org',
    notes = CASE
      WHEN COALESCE(notes, '') = '' THEN 'Jennifer Buckley (JENNIFERBUCKLEY@bpsma.org) was also listed here -- unclear role, ask Michelle who she is / what position before adding her anywhere.'
      WHEN notes NOT LIKE '%Jennifer Buckley%' THEN notes || E'\n\n' || 'Jennifer Buckley (JENNIFERBUCKLEY@bpsma.org) was also listed here -- unclear role, ask Michelle who she is / what position before adding her anywhere.'
      ELSE notes
    END
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%high%' AND cr.school ILIKE '%champion%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Champion (High)'; END IF;
END $$;

-- Edison: only the Principal's NAME was known (Dr. Soraya Calixte) --
-- everything else, including her own email, was "?" or blank. Nothing
-- written; needs Michelle's info entirely.

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Dr. Kelly A. Silva', principal_email = 'kellyasilva@bpsma.org',
    asst_principal = 'Michael Robinson',
    nurse_name = '❗️Allison Smith', nurse_email = 'allisonsmith@bpsma.org',
    notes = CASE
      WHEN COALESCE(notes, '') = '' THEN 'Stephanie Spillane -- Academic Associate Principal (role/placement unclear, ask Michelle).'
      WHEN notes NOT LIKE '%Stephanie Spillane%' THEN notes || E'\n\n' || 'Stephanie Spillane -- Academic Associate Principal (role/placement unclear, ask Michelle).'
      ELSE notes
    END
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%high%' AND cr.school ILIKE '%promise%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Promise (High)'; END IF;
END $$;

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Diane J. Lynch', principal_email = 'dianejlynch@bpsma.org',
    front_desk = 'Marti Gustin', front_desk_email = 'martigustin@bpsma.org',
    nurse_name = 'Dianne Davis', nurse_email = 'diannedavis@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%high%' AND cr.school ILIKE '%virtual%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Virtual Learning (High)'; END IF;
END $$;

-- Adult Learning: sheet had no usable info at all (principal name
-- blank, everything else "-"/blank). Nothing written; needs
-- Michelle's info entirely.

DO $$ DECLARE r int; BEGIN
  UPDATE contact_rows cr SET
    principal = 'Kevin Mccaskill', principal_email = 'kevinmccaskill@bpsma.org',
    asst_principal = 'Rachael Umbrianna', asst_principal_email = 'RACHAELUMBRIANNA@bpsma.org',
    nurse_name = '❗️Rachael Nazon', nurse_email = 'RACHELNAZON@bpsma.org'
  FROM contact_groups cg WHERE cr.group_id = cg.id AND cg.name ILIKE '%high%' AND cr.school ILIKE '%brockton hc%';
  GET DIAGNOSTICS r = ROW_COUNT; IF r = 0 THEN RAISE NOTICE 'NO MATCH: Brockton HC (High)'; END IF;
END $$;

-- ============================= VERIFY =============================
-- After running everything above, check the Messages/output panel for
-- any "NO MATCH" notices, then eyeball this to confirm the data looks
-- right:
SELECT cg.name AS "group", cr.school, cr.principal, cr.asst_principal, cr.front_desk, cr.nurse_name, cr.notes
FROM contact_rows cr JOIN contact_groups cg ON cg.id = cr.group_id
ORDER BY cg.sort_order, cr.sort_order;
