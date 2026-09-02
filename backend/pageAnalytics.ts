import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { pageViewDaily } from "@shared/schema";
import type { PortalId } from "@shared/portal";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function recordPageView(portal: PortalId): Promise<void> {
  const viewDate = todayIso();
  const [existing] = await db
    .select()
    .from(pageViewDaily)
    .where(
      and(
        eq(pageViewDaily.portal, portal),
        eq(pageViewDaily.viewDate, viewDate),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(pageViewDaily)
      .set({ views: existing.views + 1 })
      .where(eq(pageViewDaily.id, existing.id));
    return;
  }

  await db.insert(pageViewDaily).values({
    portal,
    viewDate,
    views: 1,
  });
}

export type MonthlyAnalytics = {
  month: string;
  totalViews: number;
  daily: Array<{ day: number; views: number }>;
};

export async function getMonthlyAnalytics(
  portal: PortalId,
  year: number,
  month: number,
): Promise<MonthlyAnalytics> {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const rows = await db
    .select()
    .from(pageViewDaily)
    .where(
      and(
        eq(pageViewDaily.portal, portal),
        gte(pageViewDaily.viewDate, start),
        lte(pageViewDaily.viewDate, end),
      ),
    );

  const map = new Map<number, number>();
  for (const r of rows) {
    const day = Number(r.viewDate.split("-")[2]);
    map.set(day, r.views);
  }

  const daily: Array<{ day: number; views: number }> = [];
  let totalViews = 0;
  for (let d = 1; d <= lastDay; d++) {
    const views = map.get(d) || 0;
    totalViews += views;
    daily.push({ day: d, views });
  }

  return {
    month: `${String(month).padStart(2, "0")}-${year}`,
    totalViews,
    daily,
  };
}

export async function getTodayViews(portal: PortalId): Promise<number> {
  const [row] = await db
    .select()
    .from(pageViewDaily)
    .where(
      and(
        eq(pageViewDaily.portal, portal),
        eq(pageViewDaily.viewDate, todayIso()),
      ),
    )
    .limit(1);
  return row?.views ?? 0;
}

export async function getViewsSumSince(
  portal: PortalId,
  sinceDate: string,
): Promise<number> {
  const [result] = await db
    .select({
      total: sql<number>`coalesce(sum(${pageViewDaily.views}), 0)`,
    })
    .from(pageViewDaily)
    .where(
      and(
        eq(pageViewDaily.portal, portal),
        gte(pageViewDaily.viewDate, sinceDate),
      ),
    );
  return Number(result?.total ?? 0);
}
