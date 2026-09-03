-- ============================================================
--  ZaynAI  |  OAuth Support Migration
--  File   : 03_oauth.sql
--  Run    : after 02_stored_procedures.sql
-- ============================================================

USE ZaynabInfoTech;
GO

-- ============================================================
--  OAuthAccounts
--  Links a provider identity to a ZaynAI user.
--  One user can have multiple OAuth providers linked.
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OAuthAccounts')
BEGIN
    CREATE TABLE dbo.OAuthAccounts (
        OAuthAccountId  INT             NOT NULL IDENTITY(1,1),
        UserId          NCHAR(32)       NOT NULL,
        Provider        NVARCHAR(50)    NOT NULL,   -- google | github | microsoft
        ProviderUserId  NVARCHAR(255)   NOT NULL,   -- provider's unique user id
        CreatedAt       DATETIMEOFFSET  NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_OAuthAccounts PRIMARY KEY (OAuthAccountId),
        CONSTRAINT FK_OAuthAccounts_User
            FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
        CONSTRAINT UQ_OAuthAccounts_Provider
            UNIQUE (Provider, ProviderUserId)
    );

    CREATE INDEX IX_OAuthAccounts_UserId ON dbo.OAuthAccounts (UserId);
END
GO

-- ============================================================
--  SP_UpsertOAuthUser
--
--  Logic:
--    1. If (Provider, ProviderUserId) already exists → return that user
--    2. Else if email already exists → link OAuth to existing user
--    3. Else → create new user + free subscription + link OAuth
--
--  @Result  0 = success
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_UpsertOAuthUser
    @UserId         NCHAR(32),       -- new guid, used only if creating a new user
    @OAuthId        NVARCHAR(255),   -- provider's user id
    @Provider       NVARCHAR(50),
    @Name           NVARCHAR(200),
    @Email          NVARCHAR(320),
    @Result         INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ExistingUserId NCHAR(32);

    -- 1. Check if this OAuth identity is already linked
    SELECT @ExistingUserId = UserId
    FROM   dbo.OAuthAccounts
    WHERE  Provider = @Provider AND ProviderUserId = @OAuthId;

    IF @ExistingUserId IS NOT NULL
    BEGIN
        SET @Result = 0;
        EXEC dbo.SP_GetUserById @UserId = @ExistingUserId;
        RETURN;
    END

    -- 2. Check if email already exists (link OAuth to existing account)
    SELECT @ExistingUserId = UserId
    FROM   dbo.Users
    WHERE  Email = @Email AND IsDeleted = 0;

    IF @ExistingUserId IS NOT NULL
    BEGIN
        INSERT INTO dbo.OAuthAccounts (UserId, Provider, ProviderUserId)
        VALUES (@ExistingUserId, @Provider, @OAuthId);

        SET @Result = 0;
        EXEC dbo.SP_GetUserById @UserId = @ExistingUserId;
        RETURN;
    END

    -- 3. New user — create account with free plan
    DECLARE @Now DATETIMEOFFSET = SYSDATETIMEOFFSET();

    BEGIN TRANSACTION;

        INSERT INTO dbo.Users (UserId, Name, Email, PasswordHash, CreatedAt)
        VALUES (@UserId, @Name, @Email, '', @Now);   -- empty PasswordHash = OAuth-only account

        INSERT INTO dbo.Subscriptions (UserId, PlanId, Status, StartedAt, RenewsAt)
        VALUES (@UserId, 'free', 'Active', @Now, NULL);

        INSERT INTO dbo.OAuthAccounts (UserId, Provider, ProviderUserId)
        VALUES (@UserId, @Provider, @OAuthId);

    COMMIT TRANSACTION;

    SET @Result = 0;
    EXEC dbo.SP_GetUserById @UserId = @UserId;
END;
GO
