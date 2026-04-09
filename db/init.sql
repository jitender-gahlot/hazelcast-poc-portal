-- ── POC Portal — PostgreSQL schema + seed data ──────────────────────────────
-- Runs automatically when the postgres container first starts
-- (mounted at /docker-entrypoint-initdb.d/init.sql)
-- ────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pocs (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account       VARCHAR(255) NOT NULL,
    vertical      VARCHAR(255),
    type          VARCHAR(255),
    se_owner      VARCHAR(255),
    ae_owner      VARCHAR(255),
    stage         VARCHAR(100) NOT NULL DEFAULT 'Discovery',
    invite_code   VARCHAR(50)  UNIQUE NOT NULL,
    external_data JSONB        NOT NULL DEFAULT '{}',
    internal_data JSONB        NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(50)  NOT NULL DEFAULT 'prospect'
                    CHECK (role IN ('admin', 'prospect')),
    poc_id        UUID         REFERENCES pocs(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pocs_invite_code ON pocs(invite_code);
CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pocs_set_updated_at ON pocs;
CREATE TRIGGER pocs_set_updated_at
    BEFORE UPDATE ON pocs FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ── Seed: demo POC ────────────────────────────────────────────────────────────

INSERT INTO pocs (id, account, vertical, type, se_owner, ae_owner, stage, invite_code, external_data, internal_data)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'HDFC Bank',
  'Banking / Financial Services',
  'Bake-off / competitive',
  'Jitender',
  'Priya Mehta',
  'POC Active',
  'POC-HDFC',
  $external${
    "usecase":       "Sub-50ms fraud scoring at 50K TPS with ML feature serving",
    "usecase2":      "Session cache for internet banking",
    "scopeNarrative":"Validate that Hazelcast IMDG can replace Redis Enterprise in the fraud detection hot path while maintaining SLA and adding native stream processing.",
    "dataVol":       "50M customer profiles, 200GB hot dataset",
    "throughput":    "50K TPS reads, 5K TPS writes",
    "env":           "Customer on-prem (isolated lab)",
    "proddata":      "No — synthetic / anonymised data only",
    "capabilities":  ["cache","stream","cp","security","mgmt"],
    "perfMetric":    "p99 read latency",
    "perfTarget":    "< 10ms at 50K TPS sustained",
    "funcCrit":      "MapStore failover completes in < 30s with zero data loss",
    "opsCrit":       "Rolling upgrade of 5-node cluster with zero downtime",
    "intCrit":       "Kafka ingestion confirmed at 10K events/sec",
    "extraCrit":     "",
    "outScope":      "Production sizing, full data migration, CI/CD pipeline, multi-tenancy",
    "kickoff":       "2024-02-05",
    "duration":      "4 weeks",
    "readout":       "2024-03-05",
    "timelineNotes": "Gate review with CISO team at end of W2",
    "prereqs":       ["infra","data","resource","license","channel"],
    "go":            "Move to commercial proposal within 2 weeks. Champion presents to CTO.",
    "nogo":          "Identify gap, propose targeted Phase 2, SE escalation.",
    "comms":         "Weekly sync Mondays 11am IST · Slack #hdfc-poc-2024"
  }$external$::jsonb,
  $internal${
    "pain":        "CISO called Redis OOM crashes 'embarrassing' in the board meeting. Two production outages last quarter. Settlement window failures cost ₹8Cr in operational penalties.",
    "impact":      "₹40Cr estimated annual fraud exposure. 3 pending RBI notices. Redis renewal coming up in 4 months — contract leverage.",
    "initiative":  "Platform 2.0 — CTO Rajesh mandate, ₹80Cr budget pre-approved. Redis replacement is part of 'no single vendor dependency' charter.",
    "urgency":     "Redis contract renewal in 4 months. VP Infra leaving — new hire starts Feb, wants to make a mark. RBI compliance audit in Q3.",
    "buyer":       "Rajesh Kumar · CTO · Full budget authority",
    "champion":    "Ankit Sharma · Principal Architect · High credibility, ex-Amazon",
    "champWin":    "Ankit gets promoted to Distinguished Engineer if Platform 2.0 ships on time",
    "blocker":     "Sanjay Gupta · VP Infra · Prefers open-source only, worries about vendor lock-in",
    "politics":    "Tension between Sanjay (infra) and Rajesh (CTO). Rajesh is Ankit's sponsor. If we get Rajesh in the room Sanjay will fall in line. Finance team has veto on any deal > ₹2Cr.",
    "incumbent":   "Redis Enterprise 7.x, 24-node cluster, 3 DCs, contract value ₹1.8Cr/yr",
    "competitors": "Apache Ignite (evaluated 2022, rejected for ops complexity)",
    "fud":         "\"Redis is battle-tested and we know it.\" Counter: 3 OOM crashes last quarter, that IS the battle.",
    "diff":        "CP subsystem — they need linearisable locks for settlement reconciliation. Redis cannot do this.",
    "risksExtra":  "Sanjay might brief the Redis account team about our POC. Monitor LinkedIn for Redis activity.",
    "effort":      "Deep — 15 SE-days",
    "dealSize":    "₹2.2Cr ARR (E+), potential ₹6Cr over 3 years",
    "seNotes":     "Ankit whispered 'we need someone to help us get the board past the open-source objection' — coaching role as much as technical."
  }$internal$::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ── Seed: demo admin user (password: admin123) ────────────────────────────────
-- Uses pgcrypto to hash the password with bcrypt cost 12.
-- bcryptjs on the Node side can verify $2a$ hashes from pgcrypto.

INSERT INTO users (id, name, email, password_hash, role, poc_id)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'Jitender (SE)',
  'admin@poc.io',
  crypt('admin123', gen_salt('bf', 12)),
  'admin',
  NULL
)
ON CONFLICT (email) DO NOTHING;
