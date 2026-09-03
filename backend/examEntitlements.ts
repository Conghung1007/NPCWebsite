import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "./db";
import {
  examPackages,
  examLevelEntitlements,
  exams,
  type ExamPackage,
  type ExamLevelEntitlement,
} from "@shared/schema";
import {
  EXAM_LEVELS,
  EXAM_PACKAGE_PRICE_VND,
  isExamLevel,
  type ExamLevel,
} from "@shared/examAccess";

export type ExamPackageInput = {
  name: string;
  description?: string | null;
  level?: string | null;
  examCount: number;
  priceVnd: number;
  compareAtPriceVnd?: number | null;
  isActive?: boolean;
  sortOrder?: number;
};

/** Giá gốc hợp lệ chỉ khi lớn hơn giá sale. */
export function normalizeCompareAtPriceVnd(
  compareAt: unknown,
  salePriceVnd: number,
): number | null {
  const sale = Math.max(0, Math.floor(salePriceVnd) || 0);
  if (compareAt === null || compareAt === undefined || compareAt === "") {
    return null;
  }
  const list = Math.max(0, Math.floor(Number(compareAt)) || 0);
  if (list <= sale) return null;
  return list;
}

/** Số đề hiển thị trên cửa hàng — ưu tiên đề đã gắn, fallback examCount khai báo. */
export function resolveDisplayExamCount(
  examCount: number,
  linkedExamCount: number,
): number {
  return linkedExamCount > 0
    ? linkedExamCount
    : Math.max(0, Math.floor(examCount) || 0);
}

export async function listExamPackages(opts?: {
  activeOnly?: boolean;
}): Promise<ExamPackage[]> {
  if (opts?.activeOnly) {
    return db
      .select()
      .from(examPackages)
      .where(eq(examPackages.isActive, true))
      .orderBy(asc(examPackages.sortOrder), asc(examPackages.name));
  }
  return db
    .select()
    .from(examPackages)
    .orderBy(asc(examPackages.sortOrder), asc(examPackages.name));
}

export async function getExamPackage(
  id: string,
): Promise<ExamPackage | undefined> {
  const [row] = await db
    .select()
    .from(examPackages)
    .where(eq(examPackages.id, id))
    .limit(1);
  return row;
}

export async function createExamPackage(
  input: ExamPackageInput,
): Promise<ExamPackage> {
  const [row] = await db
    .insert(examPackages)
    .values({
      id: randomUUID(),
      name: input.name.trim(),
      description: input.description ?? null,
      level: isExamLevel(input.level) ? input.level : null,
      examCount: Math.max(0, Math.floor(input.examCount) || 0),
      priceVnd: Math.max(0, Math.floor(input.priceVnd) || 0),
      compareAtPriceVnd: normalizeCompareAtPriceVnd(
        input.compareAtPriceVnd,
        input.priceVnd,
      ),
      isActive: input.isActive !== false,
      sortOrder: input.sortOrder ?? 0,
      createdAt: new Date(),
    })
    .returning();
  return row;
}

export async function updateExamPackage(
  id: string,
  input: Partial<ExamPackageInput>,
): Promise<ExamPackage | null> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.level !== undefined) {
    patch.level = isExamLevel(input.level) ? input.level : null;
  }
  if (input.examCount !== undefined) {
    patch.examCount = Math.max(0, Math.floor(input.examCount) || 0);
  }
  if (input.priceVnd !== undefined) {
    patch.priceVnd = Math.max(0, Math.floor(input.priceVnd) || 0);
  }
  if (input.compareAtPriceVnd !== undefined) {
    const sale =
      input.priceVnd !== undefined
        ? Math.max(0, Math.floor(input.priceVnd) || 0)
        : undefined;
    if (sale !== undefined) {
      patch.compareAtPriceVnd = normalizeCompareAtPriceVnd(
        input.compareAtPriceVnd,
        sale,
      );
    } else {
      const existing = await getExamPackage(id);
      patch.compareAtPriceVnd = normalizeCompareAtPriceVnd(
        input.compareAtPriceVnd,
        existing?.priceVnd ?? 0,
      );
    }
  }
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

  if (
    input.priceVnd !== undefined &&
    input.compareAtPriceVnd === undefined
  ) {
    const existing = await getExamPackage(id);
    patch.compareAtPriceVnd = normalizeCompareAtPriceVnd(
      existing?.compareAtPriceVnd,
      patch.priceVnd as number,
    );
  }

  const [row] = await db
    .update(examPackages)
    .set(patch)
    .where(eq(examPackages.id, id))
    .returning();
  return row ?? null;
}

export async function deleteExamPackage(id: string): Promise<boolean> {
  // Unlink exams first
  await db
    .update(exams)
    .set({ packageId: null })
    .where(eq(exams.packageId, id));
  const deleted = await db
    .delete(examPackages)
    .where(eq(examPackages.id, id))
    .returning();
  return deleted.length > 0;
}

/** Seed N5–N1 packages if catalog empty */
export async function ensureDefaultExamPackages(): Promise<void> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(examPackages);
  if (n > 0) return;

  let order = 0;
  for (const level of EXAM_LEVELS) {
    await db.insert(examPackages).values({
      id: randomUUID(),
      name: `Gói đề ${level}`,
      description: `Gói luyện thi cấp ${level}`,
      level,
      examCount: 5,
      priceVnd: EXAM_PACKAGE_PRICE_VND,
      isActive: true,
      sortOrder: order++,
      createdAt: new Date(),
    });
  }
}

export async function countExamsInPackage(packageId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(exams)
    .where(eq(exams.packageId, packageId));
  return n;
}

export type PackageExamSummary = {
  id: string;
  title: string;
  level: string | null;
  isActive: boolean | null;
  isDemo: boolean | null;
};

export async function listExamsInPackage(
  packageId: string,
): Promise<PackageExamSummary[]> {
  return db
    .select({
      id: exams.id,
      title: exams.title,
      level: exams.level,
      isActive: exams.isActive,
      isDemo: exams.isDemo,
    })
    .from(exams)
    .where(eq(exams.packageId, packageId))
    .orderBy(asc(exams.title));
}

/** Replace exams linked to a package (moves exams from other packages if selected). */
export type SetPackageExamsResult = {
  linkedCount: number;
  missingIds: string[];
};

export async function setPackageExams(
  packageId: string,
  examIds: string[],
): Promise<SetPackageExamsResult> {
  const pkg = await getExamPackage(packageId);
  if (!pkg) {
    throw new Error("Gói đề không tồn tại");
  }

  const uniqueIds = [...new Set(examIds.map((id) => id.trim()).filter(Boolean))];

  await db
    .update(exams)
    .set({ packageId: null, isLevelTrial: false })
    .where(eq(exams.packageId, packageId));

  if (uniqueIds.length === 0) {
    await updateExamPackage(packageId, { examCount: 0 });
    return { linkedCount: 0, missingIds: [] };
  }

  const existingRows = await db
    .select({ id: exams.id })
    .from(exams)
    .where(inArray(exams.id, uniqueIds));
  const existingSet = new Set(existingRows.map((r) => r.id));
  const validIds = uniqueIds.filter((id) => existingSet.has(id));
  const missingIds = uniqueIds.filter((id) => !existingSet.has(id));

  if (validIds.length > 0) {
    await db
      .update(exams)
      .set({ packageId, isLevelTrial: false })
      .where(inArray(exams.id, validIds));

    const trialExamId = validIds[0];
    await db
      .update(exams)
      .set({ isLevelTrial: true })
      .where(eq(exams.id, trialExamId));
  }

  const linkedCount = await countExamsInPackage(packageId);
  await updateExamPackage(packageId, {
    examCount: linkedCount,
  });

  return { linkedCount, missingIds };
}

export async function listEntitlementsForUser(
  userId: string,
): Promise<ExamLevelEntitlement[]> {
  return db
    .select()
    .from(examLevelEntitlements)
    .where(eq(examLevelEntitlements.userId, userId))
    .orderBy(desc(examLevelEntitlements.createdAt));
}

const purchasedExamSelect = {
  id: exams.id,
  title: exams.title,
  description: exams.description,
  level: exams.level,
  isDemo: exams.isDemo,
  isActive: exams.isActive,
  isLevelTrial: exams.isLevelTrial,
  sections: exams.sections,
  vocabularyTimeLimit: exams.vocabularyTimeLimit,
  grammarTimeLimit: exams.grammarTimeLimit,
  listeningTimeLimit: exams.listeningTimeLimit,
  readingTimeLimit: exams.readingTimeLimit,
  vocabularyQuestions: exams.vocabularyQuestions,
  grammarQuestions: exams.grammarQuestions,
  listeningQuestions: exams.listeningQuestions,
  readingQuestions: exams.readingQuestions,
};

export type PurchasedExamItem = {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  isDemo: boolean | null;
  isActive: boolean | null;
  isLevelTrial: boolean | null;
  sections: unknown;
  vocabularyTimeLimit: number | null;
  grammarTimeLimit: number | null;
  listeningTimeLimit: number | null;
  readingTimeLimit: number | null;
  vocabularyQuestions: unknown;
  grammarQuestions: unknown;
  listeningQuestions: unknown;
  readingQuestions: unknown;
};

export type PurchasedPackageGroup = {
  entitlementId: string;
  packageId: string | null;
  name: string;
  level: string | null;
  status: string;
  exams: PurchasedExamItem[];
};

export async function listPurchasedPackagesForUser(
  userId: string,
): Promise<PurchasedPackageGroup[]> {
  const rows = await listEntitlementsForUser(userId);
  const groups: PurchasedPackageGroup[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.status !== "active" && row.status !== "pending") continue;

    if (row.packageId) {
      const key = `pkg:${row.packageId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const pkg = await getExamPackage(row.packageId);
      const examRows = await db
        .select(purchasedExamSelect)
        .from(exams)
        .where(eq(exams.packageId, row.packageId))
        .orderBy(asc(exams.title));
      groups.push({
        entitlementId: row.id,
        packageId: row.packageId,
        name: pkg?.name || "Gói đề",
        level: pkg?.level || row.level || null,
        status: row.status,
        exams: examRows.filter((e) => e.isActive !== false),
      });
      continue;
    }

    if (row.status === "active" && isExamLevel(row.level)) {
      const key = `lvl:${row.level}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const examRows = await db
        .select(purchasedExamSelect)
        .from(exams)
        .where(eq(exams.level, row.level))
        .orderBy(asc(exams.title));
      groups.push({
        entitlementId: row.id,
        packageId: null,
        name: `Gói ${row.level.toUpperCase()}`,
        level: row.level,
        status: row.status,
        exams: examRows.filter((e) => e.isActive !== false && !e.isDemo),
      });
    }
  }

  return groups;
}

export async function listActiveLevelsForUser(
  userId: string,
): Promise<ExamLevel[]> {
  const rows = await db
    .select()
    .from(examLevelEntitlements)
    .where(
      and(
        eq(examLevelEntitlements.userId, userId),
        eq(examLevelEntitlements.status, "active"),
      ),
    );
  return rows
    .map((r) => r.level)
    .filter((l): l is ExamLevel => isExamLevel(l));
}

export async function listActivePackageIdsForUser(
  userId: string,
): Promise<string[]> {
  const rows = await db
    .select()
    .from(examLevelEntitlements)
    .where(
      and(
        eq(examLevelEntitlements.userId, userId),
        eq(examLevelEntitlements.status, "active"),
      ),
    );
  return rows.map((r) => r.packageId).filter((id): id is string => !!id);
}

export async function listAllEntitlements(): Promise<ExamLevelEntitlement[]> {
  return db
    .select()
    .from(examLevelEntitlements)
    .orderBy(desc(examLevelEntitlements.createdAt));
}

export async function requestExamPackageById(input: {
  userId: string;
  packageId: string;
  note?: string;
}): Promise<ExamLevelEntitlement> {
  const pkg = await getExamPackage(input.packageId);
  if (!pkg || !pkg.isActive) {
    throw new Error("Gói đề không tồn tại hoặc đã tắt");
  }

  const levelKey = isExamLevel(pkg.level) ? pkg.level : `pkg:${pkg.id}`;

  const existing = await db
    .select()
    .from(examLevelEntitlements)
    .where(
      and(
        eq(examLevelEntitlements.userId, input.userId),
        eq(examLevelEntitlements.level, levelKey),
      ),
    )
    .limit(1);

  const row = existing[0];
  if (row?.status === "active") return row;
  if (row?.status === "pending") return row;

  if (row) {
    const [updated] = await db
      .update(examLevelEntitlements)
      .set({
        status: "pending",
        packageId: pkg.id,
        amountVnd: pkg.priceVnd,
        note: input.note ?? row.note,
        reviewedAt: null,
        reviewedBy: null,
        createdAt: new Date(),
      })
      .where(eq(examLevelEntitlements.id, row.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(examLevelEntitlements)
    .values({
      id: randomUUID(),
      userId: input.userId,
      level: levelKey,
      packageId: pkg.id,
      status: "pending",
      amountVnd: pkg.priceVnd,
      note: input.note ?? null,
      createdAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
    })
    .returning();
  return created;
}

/** @deprecated prefer requestExamPackageById */
export async function requestExamPackage(input: {
  userId: string;
  level: ExamLevel;
  note?: string;
}): Promise<ExamLevelEntitlement> {
  const packages = await listExamPackages({ activeOnly: true });
  const pkg = packages.find((p) => p.level === input.level);
  if (pkg) {
    return requestExamPackageById({
      userId: input.userId,
      packageId: pkg.id,
      note: input.note,
    });
  }
  // Fallback legacy level-only row
  const existing = await db
    .select()
    .from(examLevelEntitlements)
    .where(
      and(
        eq(examLevelEntitlements.userId, input.userId),
        eq(examLevelEntitlements.level, input.level),
      ),
    )
    .limit(1);
  const row = existing[0];
  if (row?.status === "active" || row?.status === "pending") return row;
  if (row) {
    const [updated] = await db
      .update(examLevelEntitlements)
      .set({
        status: "pending",
        amountVnd: EXAM_PACKAGE_PRICE_VND,
        note: input.note ?? row.note,
        reviewedAt: null,
        reviewedBy: null,
        createdAt: new Date(),
      })
      .where(eq(examLevelEntitlements.id, row.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(examLevelEntitlements)
    .values({
      id: randomUUID(),
      userId: input.userId,
      level: input.level,
      packageId: null,
      status: "pending",
      amountVnd: EXAM_PACKAGE_PRICE_VND,
      note: input.note ?? null,
      createdAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
    })
    .returning();
  return created;
}

export async function reviewExamPackage(input: {
  id: string;
  status: "active" | "rejected";
  reviewedBy: string;
  note?: string;
}): Promise<ExamLevelEntitlement | null> {
  const [updated] = await db
    .update(examLevelEntitlements)
    .set({
      status: input.status,
      reviewedAt: new Date(),
      reviewedBy: input.reviewedBy,
      note: input.note ?? undefined,
    })
    .where(eq(examLevelEntitlements.id, input.id))
    .returning();
  return updated ?? null;
}

/** Activate entitlement after PayOS payment (idempotent if already active) */
export async function activateEntitlementForPackage(input: {
  userId: string;
  packageId: string;
  reviewedBy: string;
  note?: string;
}): Promise<ExamLevelEntitlement> {
  const pkg = await getExamPackage(input.packageId);
  if (!pkg) throw new Error("Gói đề không tồn tại");

  const levelKey = isExamLevel(pkg.level) ? pkg.level : `pkg:${pkg.id}`;

  const existing = await db
    .select()
    .from(examLevelEntitlements)
    .where(
      and(
        eq(examLevelEntitlements.userId, input.userId),
        eq(examLevelEntitlements.level, levelKey),
      ),
    )
    .limit(1);

  const row = existing[0];
  if (row?.status === "active") return row;

  if (row) {
    const [updated] = await db
      .update(examLevelEntitlements)
      .set({
        status: "active",
        packageId: pkg.id,
        amountVnd: pkg.priceVnd,
        note: input.note ?? row.note,
        reviewedAt: new Date(),
        reviewedBy: input.reviewedBy,
      })
      .where(eq(examLevelEntitlements.id, row.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(examLevelEntitlements)
    .values({
      id: randomUUID(),
      userId: input.userId,
      level: levelKey,
      packageId: pkg.id,
      status: "active",
      amountVnd: pkg.priceVnd,
      note: input.note ?? null,
      createdAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: input.reviewedBy,
    })
    .returning();
  return created;
}
