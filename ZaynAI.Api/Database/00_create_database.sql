-- ============================================================
--  AI Developer Assistant  |  Database Setup
--  File   : 00_create_database.sql
--  Run    : ONCE on SQL Server as sysadmin
-- ============================================================

-- 1. Create the database
IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'ZaynabInfoTech')
BEGIN
    CREATE DATABASE ZaynabInfoTech
        COLLATE SQL_Latin1_General_CP1_CI_AS;
END
GO

-- 2. Create a dedicated application login + user (least-privilege)
USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'ai_dev_app')
BEGIN
    CREATE LOGIN ai_dev_app
        WITH PASSWORD = 'CHANGE_THIS_STRONG_PASSWORD!',
             CHECK_POLICY = ON,
             CHECK_EXPIRATION = OFF;
END
GO

USE ZaynabInfoTech;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'ai_dev_app')
BEGIN
    CREATE USER ai_dev_app FOR LOGIN ai_dev_app;
END
GO

-- Grant only EXECUTE on stored procedures (no direct table access)
GRANT EXECUTE ON SCHEMA::dbo TO ai_dev_app;
GO

-- 3. Run scripts in order:
--    01_schema.sql            -> tables, indexes, seed data
--    02_stored_procedures.sql -> all stored procedures

-- 4. Connection string for appsettings.json:
--    "ConnectionStrings": {
--      "DefaultConnection1": "Server=(localdb)\\MSSQLLocalDB;Database=ZaynabInfoTech;Trusted_Connection=True;TrustServerCertificate=True;"
--    }
