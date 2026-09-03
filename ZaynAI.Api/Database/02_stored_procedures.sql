-- ============================================================
--  AI Developer Assistant  |  Stored Procedures
--  File   : 02_stored_procedures.sql
--  Run    : after 01_schema.sql
-- ============================================================

USE ZaynabInfoTech;
GO

-- ============================================================
--  SP_GetAllPlans
--  Returns all active plans with their features as a JSON array.
--  Used by GET /api/plans
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_GetAllPlans
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        p.PlanId                   AS Id,
        p.Name,
        p.MonthlyPrice,
        p.MonthlyAssistantRequests,
        p.WorkspaceScans,
        p.GeminiModel,
        p.MaxOutputTokens,
        p.AllowCodeChanges,
        p.AllowWorkspaceScan,
        (
            SELECT f.Feature
            FROM   dbo.PlanFeatures f
            WHERE  f.PlanId = p.PlanId
            ORDER  BY f.SortOrder
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        ) AS FeaturesJson
    FROM  dbo.SubscriptionPlans p
    WHERE p.IsActive = 1
    ORDER BY p.MonthlyPrice;
END;
GO

-- ============================================================
--  SP_GetPlanCapabilities
--  Returns Gemini model + capability gates for a given plan.
--  Used by AssistantGateway before calling Gemini.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_GetPlanCapabilities
    @PlanId NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        GeminiModel,
        MaxOutputTokens,
        AllowCodeChanges,
        AllowWorkspaceScan
    FROM  dbo.SubscriptionPlans
    WHERE PlanId = @PlanId
      AND IsActive = 1;
END;
GO

-- ============================================================
--  SP_SignUp
--  Creates a new user + active subscription.
--  Returns the full user row on success, or an error code.
--
--  @Result  0 = success
--           1 = email already exists
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_SignUp
    @UserId       NCHAR(32),
    @Name         NVARCHAR(200),
    @Email        NVARCHAR(320),
    @PasswordHash NVARCHAR(500),
    @PlanId       NVARCHAR(50),
    @Result       INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Duplicate email check
    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email AND IsDeleted = 0)
    BEGIN
        SET @Result = 1;
        RETURN;
    END

    -- Fallback to free plan if supplied plan is unknown
    IF NOT EXISTS (SELECT 1 FROM dbo.SubscriptionPlans WHERE PlanId = @PlanId AND IsActive = 1)
        SET @PlanId = 'free';

    DECLARE @Now          DATETIMEOFFSET = SYSDATETIMEOFFSET();
    DECLARE @MonthlyPrice DECIMAL(10,2);
    SELECT  @MonthlyPrice = MonthlyPrice FROM dbo.SubscriptionPlans WHERE PlanId = @PlanId;

    BEGIN TRANSACTION;

        INSERT INTO dbo.Users (UserId, Name, Email, PasswordHash, CreatedAt)
        VALUES (@UserId, @Name, @Email, @PasswordHash, @Now);

        INSERT INTO dbo.Subscriptions (UserId, PlanId, Status, StartedAt, RenewsAt)
        VALUES (
            @UserId,
            @PlanId,
            'Active',
            @Now,
            CASE WHEN @MonthlyPrice > 0 THEN DATEADD(MONTH, 1, @Now) ELSE NULL END
        );

    COMMIT TRANSACTION;

    SET @Result = 0;

    -- Return full user + subscription for the API response
    EXEC dbo.SP_GetUserByEmail @Email = @Email;
END;
GO

-- ============================================================
--  SP_SignIn
--  Fetches the user row for credential verification.
--  The C# layer does the password hash comparison.
--  Updates LastSignedInAt on success.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_SignIn
    @Email NVARCHAR(320)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.UserId,
        u.Name,
        u.Email,
        u.PasswordHash,
        u.CreatedAt,
        u.LastSignedInAt,
        s.SubscriptionId,
        s.PlanId,
        p.Name          AS PlanName,
        p.MonthlyPrice,
        s.Status        AS SubscriptionStatus,
        s.StartedAt,
        s.RenewsAt,
        s.CanceledAt
    FROM  dbo.Users u
    JOIN  dbo.Subscriptions s
          ON  s.UserId = u.UserId
          AND s.SubscriptionId = (
                SELECT TOP 1 SubscriptionId
                FROM   dbo.Subscriptions
                WHERE  UserId = u.UserId
                ORDER  BY CreatedAt DESC
              )
    JOIN  dbo.SubscriptionPlans p ON p.PlanId = s.PlanId
    WHERE u.Email     = @Email
      AND u.IsDeleted = 0;
END;
GO

-- ============================================================
--  SP_UpdateLastSignedIn
--  Called after a successful password verification.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_UpdateLastSignedIn
    @UserId NCHAR(32)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Users
    SET    LastSignedInAt = SYSDATETIMEOFFSET()
    WHERE  UserId = @UserId;
END;
GO

-- ============================================================
--  SP_GetUserByEmail
--  Used by /api/me and token validation.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_GetUserByEmail
    @Email NVARCHAR(320)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.UserId,
        u.Name,
        u.Email,
        u.CreatedAt,
        u.LastSignedInAt,
        s.SubscriptionId,
        s.PlanId,
        p.Name          AS PlanName,
        p.MonthlyPrice,
        s.Status        AS SubscriptionStatus,
        s.StartedAt,
        s.RenewsAt,
        s.CanceledAt
    FROM  dbo.Users u
    JOIN  dbo.Subscriptions s
          ON  s.UserId = u.UserId
          AND s.SubscriptionId = (
                SELECT TOP 1 SubscriptionId
                FROM   dbo.Subscriptions
                WHERE  UserId = u.UserId
                ORDER  BY CreatedAt DESC
              )
    JOIN  dbo.SubscriptionPlans p ON p.PlanId = s.PlanId
    WHERE u.Email     = @Email
      AND u.IsDeleted = 0;
END;
GO

-- ============================================================
--  SP_GetUserById
--  Convenience overload used internally.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_GetUserById
    @UserId NCHAR(32)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.UserId,
        u.Name,
        u.Email,
        u.CreatedAt,
        u.LastSignedInAt,
        s.SubscriptionId,
        s.PlanId,
        p.Name          AS PlanName,
        p.MonthlyPrice,
        s.Status        AS SubscriptionStatus,
        s.StartedAt,
        s.RenewsAt,
        s.CanceledAt
    FROM  dbo.Users u
    JOIN  dbo.Subscriptions s
          ON  s.UserId = u.UserId
          AND s.SubscriptionId = (
                SELECT TOP 1 SubscriptionId
                FROM   dbo.Subscriptions
                WHERE  UserId = u.UserId
                ORDER  BY CreatedAt DESC
              )
    JOIN  dbo.SubscriptionPlans p ON p.PlanId = s.PlanId
    WHERE u.UserId    = @UserId
      AND u.IsDeleted = 0;
END;
GO

-- ============================================================
--  SP_ChangeSubscription
--  Cancels the current subscription and creates a new active one.
--  Used by PUT /api/subscription
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_ChangeSubscription
    @UserId NCHAR(32),
    @NewPlanId NVARCHAR(50),
    @Result    INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.SubscriptionPlans WHERE PlanId = @NewPlanId AND IsActive = 1)
    BEGIN
        SET @Result = 1;  -- unknown plan
        RETURN;
    END

    DECLARE @Now          DATETIMEOFFSET = SYSDATETIMEOFFSET();
    DECLARE @MonthlyPrice DECIMAL(10,2);
    SELECT  @MonthlyPrice = MonthlyPrice FROM dbo.SubscriptionPlans WHERE PlanId = @NewPlanId;

    BEGIN TRANSACTION;

        -- Cancel current active subscription
        UPDATE dbo.Subscriptions
        SET    Status     = 'Canceled',
               CanceledAt = @Now,
               RenewsAt   = NULL,
               UpdatedAt  = @Now
        WHERE  UserId = @UserId
          AND  Status = 'Active';

        -- Create new active subscription
        INSERT INTO dbo.Subscriptions (UserId, PlanId, Status, StartedAt, RenewsAt)
        VALUES (
            @UserId,
            @NewPlanId,
            'Active',
            @Now,
            CASE WHEN @MonthlyPrice > 0 THEN DATEADD(MONTH, 1, @Now) ELSE NULL END
        );

    COMMIT TRANSACTION;

    SET @Result = 0;

    EXEC dbo.SP_GetUserById @UserId = @UserId;
END;
GO

-- ============================================================
--  SP_CancelSubscription
--  Marks the current active subscription as Canceled.
--  Used by POST /api/subscription/cancel
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_CancelSubscription
    @UserId NCHAR(32)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIMEOFFSET = SYSDATETIMEOFFSET();

    UPDATE dbo.Subscriptions
    SET    Status     = 'Canceled',
           CanceledAt = @Now,
           RenewsAt   = NULL,
           UpdatedAt  = @Now
    WHERE  UserId = @UserId
      AND  Status = 'Active';

    EXEC dbo.SP_GetUserById @UserId = @UserId;
END;
GO

-- ============================================================
--  SP_CheckAssistantQuota
--  Returns whether the user can make another assistant request
--  this billing month, and which Gemini model/caps to use.
--
--  @CanProceed  1 = allowed, 0 = quota exceeded
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_CheckAssistantQuota
    @UserId      NCHAR(32),
    @CanProceed  BIT OUTPUT,
    @GeminiModel         NVARCHAR(100) OUTPUT,
    @MaxOutputTokens     INT           OUTPUT,
    @AllowCodeChanges    BIT           OUTPUT,
    @AllowWorkspaceScan  BIT           OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    -- Get current active subscription + plan caps
    DECLARE
        @SubscriptionId          INT,
        @PlanId                  NVARCHAR(50),
        @MonthlyAssistantRequests INT,
        @SubscriptionStatus      NVARCHAR(20);

    SELECT TOP 1
        @SubscriptionId          = s.SubscriptionId,
        @PlanId                  = s.PlanId,
        @SubscriptionStatus      = s.Status,
        @MonthlyAssistantRequests = p.MonthlyAssistantRequests,
        @GeminiModel             = p.GeminiModel,
        @MaxOutputTokens         = p.MaxOutputTokens,
        @AllowCodeChanges        = p.AllowCodeChanges,
        @AllowWorkspaceScan      = p.AllowWorkspaceScan
    FROM  dbo.Subscriptions s
    JOIN  dbo.SubscriptionPlans p ON p.PlanId = s.PlanId
    WHERE s.UserId = @UserId
      AND s.Status = 'Active'
    ORDER BY s.CreatedAt DESC;

    IF @SubscriptionId IS NULL OR @SubscriptionStatus != 'Active'
    BEGIN
        SET @CanProceed = 0;
        RETURN;
    END

    -- Count requests in the current calendar month
    DECLARE @UsedThisMonth INT;
    SELECT  @UsedThisMonth = COUNT(*)
    FROM    dbo.AssistantRequests
    WHERE   UserId    = @UserId
      AND   StatusCode = 200
      AND   YEAR(CreatedAt)  = YEAR(SYSDATETIMEOFFSET())
      AND   MONTH(CreatedAt) = MONTH(SYSDATETIMEOFFSET());

    SET @CanProceed = CASE WHEN @UsedThisMonth < @MonthlyAssistantRequests THEN 1 ELSE 0 END;
END;
GO

-- ============================================================
--  SP_LogAssistantRequest
--  Inserts one row into AssistantRequests after each call.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_LogAssistantRequest
    @UserId          NCHAR(32),
    @Area            NVARCHAR(100),
    @GeminiModel     NVARCHAR(100),
    @PromptTokens    INT,
    @CompletionTokens INT,
    @StatusCode      INT,
    @ErrorMessage    NVARCHAR(1000) = NULL,
    @DurationMs      INT            = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @SubscriptionId INT;
    DECLARE @PlanId         NVARCHAR(50);

    SELECT TOP 1
        @SubscriptionId = SubscriptionId,
        @PlanId         = PlanId
    FROM  dbo.Subscriptions
    WHERE UserId = @UserId
      AND Status = 'Active'
    ORDER BY CreatedAt DESC;

    INSERT INTO dbo.AssistantRequests
        (UserId, SubscriptionId, PlanId, Area, GeminiModel,
         PromptTokens, CompletionTokens, StatusCode, ErrorMessage, DurationMs)
    VALUES
        (@UserId, @SubscriptionId, @PlanId, @Area, @GeminiModel,
         @PromptTokens, @CompletionTokens, @StatusCode, @ErrorMessage, @DurationMs);
END;
GO

-- ============================================================
--  SP_CheckWorkspaceScanQuota
--  Same pattern as SP_CheckAssistantQuota but for scans.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_CheckWorkspaceScanQuota
    @UserId     NCHAR(32),
    @CanProceed BIT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @PlanId        NVARCHAR(50);
    DECLARE @WorkspaceScans INT;
    DECLARE @AllowScan     BIT;

    SELECT TOP 1
        @PlanId         = s.PlanId,
        @WorkspaceScans = p.WorkspaceScans,
        @AllowScan      = p.AllowWorkspaceScan
    FROM  dbo.Subscriptions s
    JOIN  dbo.SubscriptionPlans p ON p.PlanId = s.PlanId
    WHERE s.UserId = @UserId
      AND s.Status = 'Active'
    ORDER BY s.CreatedAt DESC;

    IF @AllowScan = 0 OR @PlanId IS NULL
    BEGIN
        SET @CanProceed = 0;
        RETURN;
    END

    DECLARE @UsedThisMonth INT;
    SELECT  @UsedThisMonth = COUNT(*)
    FROM    dbo.WorkspaceScanRequests
    WHERE   UserId    = @UserId
      AND   StatusCode = 200
      AND   YEAR(CreatedAt)  = YEAR(SYSDATETIMEOFFSET())
      AND   MONTH(CreatedAt) = MONTH(SYSDATETIMEOFFSET());

    SET @CanProceed = CASE WHEN @UsedThisMonth < @WorkspaceScans THEN 1 ELSE 0 END;
END;
GO

-- ============================================================
--  SP_LogWorkspaceScan
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_LogWorkspaceScan
    @UserId       NCHAR(32),
    @FileCount    INT,
    @StatusCode   INT,
    @ErrorMessage NVARCHAR(1000) = NULL,
    @DurationMs   INT            = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @SubscriptionId INT;
    DECLARE @PlanId         NVARCHAR(50);

    SELECT TOP 1
        @SubscriptionId = SubscriptionId,
        @PlanId         = PlanId
    FROM  dbo.Subscriptions
    WHERE UserId = @UserId
      AND Status = 'Active'
    ORDER BY CreatedAt DESC;

    INSERT INTO dbo.WorkspaceScanRequests
        (UserId, SubscriptionId, PlanId, FileCount, StatusCode, ErrorMessage, DurationMs)
    VALUES
        (@UserId, @SubscriptionId, @PlanId, @FileCount, @StatusCode, @ErrorMessage, @DurationMs);
END;
GO

-- ============================================================
--  SP_GetUserUsageSummary
--  Returns current-month usage vs quota for a user.
--  Used by GET /api/me (usage section) and the web portal.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_GetUserUsageSummary
    @UserId NCHAR(32)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE
        @PlanId                   NVARCHAR(50),
        @PlanName                 NVARCHAR(100),
        @MonthlyAssistantRequests INT,
        @WorkspaceScans           INT,
        @GeminiModel              NVARCHAR(100),
        @AllowCodeChanges         BIT,
        @AllowWorkspaceScan       BIT;

    SELECT TOP 1
        @PlanId                   = s.PlanId,
        @PlanName                 = p.Name,
        @MonthlyAssistantRequests = p.MonthlyAssistantRequests,
        @WorkspaceScans           = p.WorkspaceScans,
        @GeminiModel              = p.GeminiModel,
        @AllowCodeChanges         = p.AllowCodeChanges,
        @AllowWorkspaceScan       = p.AllowWorkspaceScan
    FROM  dbo.Subscriptions s
    JOIN  dbo.SubscriptionPlans p ON p.PlanId = s.PlanId
    WHERE s.UserId = @UserId
      AND s.Status = 'Active'
    ORDER BY s.CreatedAt DESC;

    DECLARE @AssistantUsed INT;
    SELECT  @AssistantUsed = COUNT(*)
    FROM    dbo.AssistantRequests
    WHERE   UserId    = @UserId
      AND   StatusCode = 200
      AND   YEAR(CreatedAt)  = YEAR(SYSDATETIMEOFFSET())
      AND   MONTH(CreatedAt) = MONTH(SYSDATETIMEOFFSET());

    DECLARE @ScansUsed INT;
    SELECT  @ScansUsed = COUNT(*)
    FROM    dbo.WorkspaceScanRequests
    WHERE   UserId    = @UserId
      AND   StatusCode = 200
      AND   YEAR(CreatedAt)  = YEAR(SYSDATETIMEOFFSET())
      AND   MONTH(CreatedAt) = MONTH(SYSDATETIMEOFFSET());

    SELECT
        @PlanId                   AS PlanId,
        @PlanName                 AS PlanName,
        @GeminiModel              AS GeminiModel,
        @AllowCodeChanges         AS AllowCodeChanges,
        @AllowWorkspaceScan       AS AllowWorkspaceScan,
        @AssistantUsed            AS AssistantRequestsUsed,
        @MonthlyAssistantRequests AS AssistantRequestsLimit,
        @ScansUsed                AS WorkspaceScansUsed,
        @WorkspaceScans           AS WorkspaceScansLimit;
END;
GO

-- ============================================================
--  SP_GetAdminDashboard
--  Aggregate stats for an admin/ops dashboard.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.SP_GetAdminDashboard
AS
BEGIN
    SET NOCOUNT ON;

    -- Total users per plan
    SELECT
        p.Name                  AS PlanName,
        COUNT(DISTINCT s.UserId) AS TotalUsers,
        SUM(p.MonthlyPrice)     AS MonthlyRevenue
    FROM  dbo.Subscriptions s
    JOIN  dbo.SubscriptionPlans p ON p.PlanId = s.PlanId
    WHERE s.Status = 'Active'
    GROUP BY p.Name, p.MonthlyPrice
    ORDER BY p.MonthlyPrice DESC;

    -- Daily assistant requests (last 30 days)
    SELECT
        CAST(CreatedAt AS DATE)  AS RequestDate,
        COUNT(*)                 AS TotalRequests,
        SUM(PromptTokens)        AS TotalPromptTokens,
        SUM(CompletionTokens)    AS TotalCompletionTokens
    FROM  dbo.AssistantRequests
    WHERE CreatedAt >= DATEADD(DAY, -30, SYSDATETIMEOFFSET())
    GROUP BY CAST(CreatedAt AS DATE)
    ORDER BY RequestDate DESC;

    -- Top 10 users by request count this month
    SELECT TOP 10
        u.Name,
        u.Email,
        p.Name          AS PlanName,
        COUNT(ar.RequestId) AS RequestsThisMonth
    FROM  dbo.AssistantRequests ar
    JOIN  dbo.Users u             ON u.UserId = ar.UserId
    JOIN  dbo.Subscriptions s     ON s.SubscriptionId = ar.SubscriptionId
    JOIN  dbo.SubscriptionPlans p ON p.PlanId = s.PlanId
    WHERE YEAR(ar.CreatedAt)  = YEAR(SYSDATETIMEOFFSET())
      AND MONTH(ar.CreatedAt) = MONTH(SYSDATETIMEOFFSET())
    GROUP BY u.Name, u.Email, p.Name
    ORDER BY RequestsThisMonth DESC;
END;
GO
