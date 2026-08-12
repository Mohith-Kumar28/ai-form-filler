-- BM25 retrieval over the answer bank.
--
-- Hand-written because Drizzle has no FTS5 representation. `content=` makes this an
-- external-content index: FTS5 stores only the inverted index and reads the columns back
-- from answer_bank, so answers are not duplicated on disk. That also means the triggers
-- below are mandatory — without them the index silently drifts out of sync with the table.
--
-- Query with: ORDER BY bm25(answer_bank_fts) ASC   (more negative = better match)

CREATE VIRTUAL TABLE answer_bank_fts USING fts5(
  label,
  answer,
  content='answer_bank',
  content_rowid='rowid',
  tokenize='porter unicode61'
);
--> statement-breakpoint
CREATE TRIGGER answer_bank_fts_insert AFTER INSERT ON answer_bank BEGIN
  INSERT INTO answer_bank_fts(rowid, label, answer) VALUES (new.rowid, new.label, new.answer);
END;
--> statement-breakpoint
-- 'delete' rows are how FTS5 external-content tables retract an entry; the column values
-- must match what was indexed or the index is left corrupt.
CREATE TRIGGER answer_bank_fts_delete AFTER DELETE ON answer_bank BEGIN
  INSERT INTO answer_bank_fts(answer_bank_fts, rowid, label, answer)
    VALUES ('delete', old.rowid, old.label, old.answer);
END;
--> statement-breakpoint
CREATE TRIGGER answer_bank_fts_update AFTER UPDATE ON answer_bank BEGIN
  INSERT INTO answer_bank_fts(answer_bank_fts, rowid, label, answer)
    VALUES ('delete', old.rowid, old.label, old.answer);
  INSERT INTO answer_bank_fts(rowid, label, answer) VALUES (new.rowid, new.label, new.answer);
END;
