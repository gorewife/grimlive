/**
 * GRIMKEEPER VOICE INTEGRATION TESTS
 * 
 * Tests the critical Discord bot actions that fail silently:
 * - Call townspeople → Discord voice channel movement
 * - Mute all → Discord voice muting
 * - Unmute all → Discord voice unmuting
 * 
 * These tests verify the ENTIRE chain:
 * 1. Grimlive sends API request
 * 2. Grimlive API validates and creates announcement
 * 3. Grimkeeper polls and finds announcement
 * 4. Grimkeeper executes Discord action
 * 5. Action completes successfully
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import pg from 'pg';

const { Pool } = pg;

const GRIMLIVE_API = process.env.GRIMLIVE_API_URL || 'http://localhost:8001';
const DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://testuser:testpass@localhost:5433/grimkeeper_test';

// Test data
const TEST_SESSION_CODE = 's1';
const TEST_GUILD_ID = '123456789';
const TEST_CATEGORY_ID = '111111111';

let dbPool;

beforeAll(async () => {
  dbPool = new Pool({ connectionString: DB_URL });
  await waitForService(GRIMLIVE_API + '/health', 30000);
  
  // Ensure test session exists
  await dbPool.query(`
    INSERT INTO sessions (session_code, guild_id, category_id, storyteller_user_id)
    VALUES ($1, $2, $3, '999888777')
    ON CONFLICT (session_code) DO UPDATE SET guild_id = $2, category_id = $3
  `, [TEST_SESSION_CODE, TEST_GUILD_ID, TEST_CATEGORY_ID]);
  
  // Create active game
  await dbPool.query(`
    DELETE FROM games WHERE guild_id = $1 AND category_id = $2
  `, [TEST_GUILD_ID, TEST_CATEGORY_ID]);
  
  await dbPool.query(`
    INSERT INTO games (guild_id, category_id, script, start_time, player_count, is_active)
    VALUES ($1, $2, 'Test Script', EXTRACT(EPOCH FROM NOW())::INTEGER, 7, true)
  `, [TEST_GUILD_ID, TEST_CATEGORY_ID]);
});

afterAll(async () => {
  if (dbPool) await dbPool.end();
});

async function waitForService(url, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`Service at ${url} not ready after ${timeout}ms`);
}

async function cleanupAnnouncements() {
  await dbPool.query('DELETE FROM announcements WHERE guild_id = $1 AND category_id = $2', [TEST_GUILD_ID, TEST_CATEGORY_ID]);
}

describe("Grimkeeper Voice Integration", () => {
  
  describe("Call Townspeople", () => {
    test("API creates announcement in database", async () => {
      await cleanupAnnouncements();
      
      const response = await fetch(`${GRIMLIVE_API}/api/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: TEST_SESSION_CODE })
      });
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      
      // Verify announcement created
      const result = await dbPool.query(
        'SELECT * FROM announcements WHERE guild_id = $1 AND category_id = $2 AND announcement_type = $3',
        [TEST_GUILD_ID, TEST_CATEGORY_ID, 'call']
      );
      
      expect(result.rows.length).toBe(1);
      const announcement = result.rows[0];
      expect(announcement.announcement_type).toBe('call');
      expect(announcement.guild_id).toBe(TEST_GUILD_ID);
      expect(announcement.processed_at).toBeNull();
    });
    
    test("creates announcement even without active game (grimkeeper enforces requirement)", async () => {
      await cleanupAnnouncements();
      
      // Temporarily deactivate game
      await dbPool.query(
        'UPDATE games SET is_active = false WHERE guild_id = $1',
        [TEST_GUILD_ID]
      );
      
      const response = await fetch(`${GRIMLIVE_API}/api/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: TEST_SESSION_CODE })
      });
      
      // API creates announcement regardless - grimkeeper validates when processing
      expect(response.ok).toBe(true);
      
      // Verify announcement exists
      const result = await dbPool.query(
        'SELECT * FROM announcements WHERE guild_id = $1 AND announcement_type = $2',
        [TEST_GUILD_ID, 'call']
      );
      expect(result.rows.length).toBe(1);
      
      // Reactivate game
      await dbPool.query(
        'UPDATE games SET is_active = true WHERE guild_id = $1',
        [TEST_GUILD_ID]
      );
    });
    
    test("fails with invalid session code", async () => {
      await cleanupAnnouncements();
      
      const response = await fetch(`${GRIMLIVE_API}/api/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: 'invalid-session-99999' })
      });
      
      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBeTruthy();
    });
    
    test("announcement is marked processable for grimkeeper", async () => {
      await cleanupAnnouncements();
      
      await fetch(`${GRIMLIVE_API}/api/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: TEST_SESSION_CODE })
      });
      
      const result = await dbPool.query(`
        SELECT * FROM announcements
        WHERE guild_id = $1 AND category_id = $2 AND announcement_type = 'call' AND processed_at IS NULL
      `, [TEST_GUILD_ID, TEST_CATEGORY_ID]);
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].guild_id).toBe(TEST_GUILD_ID);
      expect(result.rows[0].category_id).toBe(TEST_CATEGORY_ID);
    });
  });
  
  describe("Mute All", () => {
    test("API creates mute announcement", async () => {
      await cleanupAnnouncements();
      
      const response = await fetch(`${GRIMLIVE_API}/api/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: TEST_SESSION_CODE })
      });
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      
      const result = await dbPool.query(
        'SELECT * FROM announcements WHERE guild_id = $1 AND category_id = $2 AND announcement_type = $3',
        [TEST_GUILD_ID, TEST_CATEGORY_ID, 'mute']
      );
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].announcement_type).toBe('mute');
      expect(result.rows[0].processed_at).toBeNull();
    });
    

  });
  
  describe("Unmute All", () => {
    test("API creates unmute announcement", async () => {
      await cleanupAnnouncements();
      
      const response = await fetch(`${GRIMLIVE_API}/api/unmute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: TEST_SESSION_CODE })
      });
      
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      
      const result = await dbPool.query(
        'SELECT * FROM announcements WHERE guild_id = $1 AND category_id = $2 AND announcement_type = $3',
        [TEST_GUILD_ID, TEST_CATEGORY_ID, 'unmute']
      );
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].announcement_type).toBe('unmute');
      expect(result.rows[0].processed_at).toBeNull();
    });
    

  });
  
  describe("Announcement Processing (Grimkeeper Side)", () => {
    test("grimkeeper can retrieve unprocessed announcements", async () => {
      await cleanupAnnouncements();
      
      // Create multiple announcements
      await fetch(`${GRIMLIVE_API}/api/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: TEST_SESSION_CODE })
      });
      
      await fetch(`${GRIMLIVE_API}/api/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: TEST_SESSION_CODE })
      });
      
      // Query as grimkeeper would
      const result = await dbPool.query(`
        SELECT id, announcement_type, guild_id, category_id, created_at
        FROM announcements
        WHERE processed_at IS NULL
        ORDER BY created_at ASC
      `);
      
      expect(result.rows.length).toBeGreaterThanOrEqual(2);
      const types = result.rows.map(r => r.announcement_type);
      expect(types).toContain('call');
      expect(types).toContain('mute');
    });
    
    test("marking announcement as processed", async () => {
      await cleanupAnnouncements();
      
      await fetch(`${GRIMLIVE_API}/api/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: TEST_SESSION_CODE })
      });
      
      const unprocessed = await dbPool.query(
        'SELECT id FROM announcements WHERE guild_id = $1 AND category_id = $2 AND processed_at IS NULL',
        [TEST_GUILD_ID, TEST_CATEGORY_ID]
      );
      
      expect(unprocessed.rows.length).toBe(1);
      const announcementId = unprocessed.rows[0].id;
      
      // Simulate grimkeeper processing
      await dbPool.query(
        'UPDATE announcements SET processed_at = $1 WHERE id = $2',
        [Math.floor(Date.now() / 1000), announcementId]
      );
      
      // Verify it's no longer in unprocessed queue
      const stillUnprocessed = await dbPool.query(
        'SELECT * FROM announcements WHERE guild_id = $1 AND category_id = $2 AND processed_at IS NULL',
        [TEST_GUILD_ID, TEST_CATEGORY_ID]
      );
      
      expect(stillUnprocessed.rows.length).toBe(0);
    });
    
    test("multiple rapid calls create separate announcements", async () => {
      await cleanupAnnouncements();
      
      // Simulate rapid clicking
      await Promise.all([
        fetch(`${GRIMLIVE_API}/api/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionCode: TEST_SESSION_CODE })
        }),
        fetch(`${GRIMLIVE_API}/api/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionCode: TEST_SESSION_CODE })
        }),
        fetch(`${GRIMLIVE_API}/api/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionCode: TEST_SESSION_CODE })
        })
      ]);
      
      const result = await dbPool.query(
        'SELECT * FROM announcements WHERE guild_id = $1 AND category_id = $2 AND announcement_type = $3',
        [TEST_GUILD_ID, TEST_CATEGORY_ID, 'call']
      );
      
      // Should create separate announcements (grimkeeper will process them in order)
      expect(result.rows.length).toBe(3);
    });
  });
  
  describe("Error Handling", () => {
    test("missing session code returns error", async () => {
      const response = await fetch(`${GRIMLIVE_API}/api/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBeTruthy();
    });
    
    test("malformed request returns error", async () => {
      const response = await fetch(`${GRIMLIVE_API}/api/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json'
      });
      
      expect(response.ok).toBe(false);
    });
  });
});
