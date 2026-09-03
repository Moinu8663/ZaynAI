-- ============================================================
--  AI Developer Assistant  |  SQL Server Schema
--  File   : 01_schema.sql
--  Run    : once on a new / empty database
-- ============================================================

USE ZaynabInfoTech;
GO

-- ============================================================
--  1. SubscriptionPlans
--     Master catalogue – mirrors PlanCatalog in Program.cs
-- ============================================================
CREATE TABLE dbo.SubscriptionPlans (
    PlanId                    NVARCHAR(50)    NOT NULL,
    Name                      NVARCHAR(100)   NOT NULL,
    MonthlyPrice              DECIMAL(10, 2)  NOT NULL DEFAULT 0,
    MonthlyAssistantRequests  INT             NOT NULL DEFAULT 0,
    WorkspaceScans            INT             NOT NULL DEFAULT 0,
    -- Gemini capability gates (mirrors appsettings.json Gemini:Plans)
    GeminiModel               NVARCHAR(100)   NOT NULL DEFAULT 'gemini-2.0-flash',
    MaxOutputTokens           INT             NOT NULL DEFAULT 1024,
    AllowCodeChanges          BIT             NOT NULL DEFAULT 0,
    AllowWorkspaceScan        BIT             NOT NULL DEFAULT 0,
    IsActive                  BIT             NOT NULL DEFAULT 1,
    CreatedAt                 DATETIMEOFFSET  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt                 DATETIMEOFFSET  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_SubscriptionPlans PRIMARY KEY (PlanId)
);
GO

-- ============================================================
--  2. PlanFeatures
--     One row per bullet-point feature per plan
-- ============================================================
CREATE TABLE dbo.PlanFeatures (
    FeatureId    INT             NOT NULL IDENTITY(1,1),
    PlanId       NVARCHAR(50)    NOT NULL,
    Feature      NVARCHAR(200)   NOT NULL,
    SortOrder    INT             NOT NULL DEFAULT 0,
    CONSTRAINT PK_PlanFeatures  PRIMARY KEY (FeatureId),
    CONSTRAINT FK_PlanFeatures_Plan
        FOREIGN KEY (PlanId) REFERENCES dbo.SubscriptionPlans (PlanId)
        ON DELETE CASCADE
);
GO

CREATE INDEX IX_PlanFeatures_PlanId ON dbo.PlanFeatures (PlanId);
GO

-- ============================================================
--  3. Users
-- ============================================================
CREATE TABLE dbo.Users (
    UserId          NCHAR(32)       NOT NULL,   -- Guid("n") format, no hyphens
    Name            NVARCHAR(200)   NOT NULL,
    Email           NVARCHAR(320)   NOT NULL,   -- RFC 5321 max
    PasswordHash    NVARCHAR(500)   NOT NULL,   -- "iterations.salt.hash"
    CreatedAt       DATETIMEOFFSET  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    LastSignedInAt  DATETIMEOFFSET  NULL,
    IsDeleted       BIT             NOT NULL DEFAULT 0,
    CONSTRAINT PK_Users       PRIMARY KEY (UserId),
    CONSTRAINT UQ_Users_Email UNIQUE      (Email)
);
GO

CREATE INDEX IX_Users_Email     ON dbo.Users (Email)     WHERE IsDeleted = 0;
CREATE INDEX IX_Users_CreatedAt ON dbo.Users (CreatedAt) WHERE IsDeleted = 0;
GO

-- ============================================================
--  4. Subscriptions
--     One active subscription per user at a time.
--     History is preserved (Status = 'Canceled').
-- ============================================================
CREATE TABLE dbo.Subscriptions (
    SubscriptionId  INT             NOT NULL IDENTITY(1,1),
    UserId          NCHAR(32)       NOT NULL,
    PlanId          NVARCHAR(50)    NOT NULL,
    Status          NVARCHAR(20)    NOT NULL DEFAULT 'Active',  -- Active | Canceled
    StartedAt       DATETIMEOFFSET  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    RenewsAt        DATETIMEOFFSET  NULL,
    CanceledAt      DATETIMEOFFSET  NULL,
    CreatedAt       DATETIMEOFFSET  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt       DATETIMEOFFSET  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_Subscriptions PRIMARY KEY (SubscriptionId),
    CONSTRAINT FK_Subscriptions_User
        FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Subscriptions_Plan
        FOREIGN KEY (PlanId) REFERENCES dbo.SubscriptionPlans (PlanId),
    CONSTRAINT CK_Subscriptions_Status
        CHECK (Status IN ('Active', 'Canceled'))
);
GO

CREATE INDEX IX_Subscriptions_UserId ON dbo.Subscriptions (UserId, Status);
CREATE INDEX IX_Subscriptions_PlanId ON dbo.Subscriptions (PlanId);
GO

-- ============================================================
--  5. AssistantRequests
--     Audit log of every /api/assistant call.
--     Enables usage metering, quota enforcement, and billing.
-- ============================================================
CREATE TABLE dbo.AssistantRequests (
    RequestId        BIGINT          NOT NULL IDENTITY(1,1),
    UserId           NCHAR(32)       NOT NULL,
    SubscriptionId   INT             NOT NULL,
    PlanId           NVARCHAR(50)    NOT NULL,
    Area             NVARCHAR(100)   NOT NULL,
    PromptTokens     INT             NULL,
    CompletionTokens INT             NULL,
    GeminiModel      NVARCHAR(100)   NOT NULL,
    StatusCode       INT             NOT NULL DEFAULT 200,
    ErrorMessage     NVARCHAR(1000)  NULL,
    DurationMs       INT             NULL,
    CreatedAt        DATETIMEOFFSET  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_AssistantRequests PRIMARY KEY (RequestId),
    CONSTRAINT FK_AssistantRequests_User
        FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_AssistantRequests_Subscription
        FOREIGN KEY (SubscriptionId) REFERENCES dbo.Subscriptions (SubscriptionId),
    CONSTRAINT FK_AssistantRequests_Plan
        FOREIGN KEY (PlanId) REFERENCES dbo.SubscriptionPlans (PlanId)
);
GO

CREATE INDEX IX_AssistantRequests_UserId    ON dbo.AssistantRequests (UserId,  CreatedAt DESC);
CREATE INDEX IX_AssistantRequests_PlanId    ON dbo.AssistantRequests (PlanId,  CreatedAt DESC);
CREATE INDEX IX_AssistantRequests_CreatedAt ON dbo.AssistantRequests (CreatedAt DESC);
GO

-- ============================================================
--  6. WorkspaceScanRequests
--     Separate quota bucket for workspace scans.
-- ============================================================
CREATE TABLE dbo.WorkspaceScanRequests (
    ScanId         BIGINT          NOT NULL IDENTITY(1,1),
    UserId         NCHAR(32)       NOT NULL,
    SubscriptionId INT             NOT NULL,
    PlanId         NVARCHAR(50)    NOT NULL,
    FileCount      INT             NULL,
    StatusCode     INT             NOT NULL DEFAULT 200,
    ErrorMessage   NVARCHAR(1000)  NULL,
    DurationMs     INT             NULL,
    CreatedAt      DATETIMEOFFSET  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_WorkspaceScanRequests PRIMARY KEY (ScanId),
    CONSTRAINT FK_WorkspaceScanRequests_User
        FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_WorkspaceScanRequests_Subscription
        FOREIGN KEY (SubscriptionId) REFERENCES dbo.Subscriptions (SubscriptionId),
    CONSTRAINT FK_WorkspaceScanRequests_Plan
        FOREIGN KEY (PlanId) REFERENCES dbo.SubscriptionPlans (PlanId)
);
GO

CREATE INDEX IX_WorkspaceScanRequests_UserId ON dbo.WorkspaceScanRequests (UserId, CreatedAt DESC);
GO

-- ============================================================
--  7. Seed  –  SubscriptionPlans + PlanFeatures
-- ============================================================
INSERT INTO dbo.SubscriptionPlans
    (PlanId, Name, MonthlyPrice, MonthlyAssistantRequests, WorkspaceScans,
     GeminiModel, MaxOutputTokens, AllowCodeChanges, AllowWorkspaceScan)
VALUES
    ('free',  'Starter',      0,  100,   5,   'gemini-2.0-flash', 1024,  0, 0),
    ('pro',   'Professional', 19, 3000,  100, 'gemini-2.5-flash', 8192,  1, 1),
    ('team',  'Team',         49, 15000, 500, 'gemini-2.5-pro',   32768, 1, 1);
GO

INSERT INTO dbo.PlanFeatures (PlanId, Feature, SortOrder) VALUES
    ('free', 'AI chat',                          1),
    ('free', 'Code explanations',                2),
    ('free', 'Basic workspace scans',            3),
    ('pro',  'Advanced code reviews',            1),
    ('pro',  'Test generation',                  2),
    ('pro',  'Migration planning',               3),
    ('pro',  'Priority models',                  4),
    ('team', 'Shared seats',                     1),
    ('team', 'Central billing',                  2),
    ('team', 'Audit history',                    3),
    ('team', 'DevOps and security workflows',    4);
GO
