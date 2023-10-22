-- This feels like overkill to store a single ID, but KV writes take 30+ seconds to propogate.
-- D1 will at least ensure our reads are consistent.
DROP TABLE IF EXISTS LastSeenPost;
CREATE TABLE IF NOT EXISTS LastSeenPost (Id INTEGER PRIMARY KEY, CfGuid TEXT, PubDate DateTime);
