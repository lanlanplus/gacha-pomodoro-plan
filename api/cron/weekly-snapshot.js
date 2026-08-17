import { createClient } from "@supabase/supabase-js";
import {
  buildWeeklySnapshotRow,
  getLastCompletedShanghaiWeek,
} from "../../src/weeklySnapshot.js";

const pageSize = 1000;
const upsertBatchSize = 500;

async function fetchAll(queryFactory) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  if (
    !process.env.CRON_SECRET
    || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return response.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return response.status(500).json({ error: "Server database credentials are not configured" });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const range = getLastCompletedShanghaiWeek();
    const [userStates, completionLogs] = await Promise.all([
      fetchAll(() => supabase
        .from("user_app_states")
        .select("user_id, app_state")
        .order("user_id", { ascending: true })),
      fetchAll(() => supabase
        .from("task_completion_log")
        .select("id, user_id, minutes")
        .gte("completed_at", range.startIso)
        .lt("completed_at", range.endIso)
        .order("id", { ascending: true })),
    ]);

    const aggregatesByUser = new Map();
    completionLogs.forEach((log) => {
      const aggregate = aggregatesByUser.get(log.user_id) || {
        completedCount: 0,
        focusMinutes: 0,
      };
      aggregate.completedCount += 1;
      if (Number.isFinite(log.minutes)) aggregate.focusMinutes += log.minutes;
      aggregatesByUser.set(log.user_id, aggregate);
    });

    const snapshots = userStates.map((userState) => buildWeeklySnapshotRow(
      userState,
      aggregatesByUser.get(userState.user_id),
      range.weekStartDate,
    ));

    for (let index = 0; index < snapshots.length; index += upsertBatchSize) {
      const { error } = await supabase
        .from("weekly_snapshots")
        .upsert(snapshots.slice(index, index + upsertBatchSize), {
          onConflict: "user_id,week_start_date",
          ignoreDuplicates: true,
        });
      if (error) throw error;
    }

    return response.status(200).json({
      ok: true,
      weekStartDate: range.weekStartDate,
      snapshotsWritten: snapshots.length,
    });
  } catch (error) {
    console.error("weekly snapshot failed", error);
    return response.status(500).json({ error: "Weekly snapshot failed" });
  }
}
