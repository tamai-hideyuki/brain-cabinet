-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_notes_cluster_id ON notes(cluster_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_relations_source_note_id ON note_relations(source_note_id);
CREATE INDEX IF NOT EXISTS idx_note_relations_target_note_id ON note_relations(target_note_id);
